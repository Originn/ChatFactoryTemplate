// utils/makechain-sse.ts

import { OpenAI as LangchainOpenAI, ChatOpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { MyDocument } from 'interfaces/Document';
import { BaseRetriever } from "@langchain/core/retrievers";
import { v4 as uuidv4 } from 'uuid';
const TenantDB = require('./TenantDB');
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { MaxMarginalRelevanceSearchOptions } from "@langchain/core/vectorstores";
import { BaseRetrieverInterface } from '@langchain/core/retrievers';
import { RunnableConfig } from '@langchain/core/runnables';
import MemoryService from '@/utils/memoryService';
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createChatModel } from './modelProviders';
import { getRelevantHistory } from './contextManager';
import { createEmbeddingModel, getModelDimensions } from './embeddingProviders';
import { isCohereProvider, createCohereMultimodalEmbedding, createCohereImageOnlyEmbedding, createCohereMultimodalEmbeddingWithBase64, convertImageUrlToBase64 } from './embeddingProviders';
import { getSchemaCache } from './schemaCache';
import { generateGraphAugmentation } from './graphCypher';
import {
  qaSystemPrompt
} from './prompts/promptTemplates';
import { getTemplateConfig } from '../config/template';
import { ensureChatSession } from './chatSession';
import { processImagesWithContext, processImagesWithContextStreaming, processImageWithOpenAI, processImageWithOpenAIStreaming, processInputConsolidated } from './inputProcessing';

// Environment configuration
const ENV = {
  MODEL_NAME: process.env.MODEL_NAME || 'gpt-4o',
  TEMPERATURE: parseFloat(process.env.TEMPERATURE || '0'),
  LAMBDA_EMBEDDINGS: parseFloat(process.env.LAMBDA_EMBEDDINGS || '0.1'),
  MINSCORESOURCESTHRESHOLD: parseFloat(process.env.MINSCORESOURCESTHRESHOLD || '0.78'),
  IMAGE_MODEL_NAME: process.env.IMAGE_MODEL_NAME || 'gpt-4o-mini',
};

// Type Definitions
type SearchResult = [MyDocument, number];

interface DocumentInterface<T> {
  pageContent: string;
  metadata: T;
}

// Helper Functions
function generateUniqueId(): string {
  return uuidv4();
}
/**
 * Update the conversation history and title
 */
async function updateConversationMemory(
  roomId: string,
  originalInput: string,
  answer: string,
  imageUrls: string[] | null,
  userEmail: string,
  documents: MyDocument[],
  qaId: string,
  newConversationTitle?: string,
  language: string = 'English'
): Promise<void> {
  try {
    let conversationTitle = newConversationTitle;

    if (!conversationTitle) {
      try {
        const db = new TenantDB();
        const existingHistory = await db.getChatHistoryByRoomId(roomId);
        if (existingHistory && existingHistory.conversation_title) {
          conversationTitle = existingHistory.conversation_title;
        } else {
          // Fallback title if something goes wrong
          conversationTitle = 'Conversation';
        }
      } catch (error) {
        console.error('Error fetching chat history for title:', error);
        conversationTitle = 'Conversation'; // Fallback title
      }
    }

    await MemoryService.updateChatMemory(
      roomId,
      originalInput,
      answer,
      imageUrls,
      userEmail,
      documents,
      qaId,
      conversationTitle
    );
  } catch (error) {
    console.error('Error updating conversation memory:', error);
  }
}
// Custom Retriever Class with enhanced efficiency and dynamic embedding support
class CustomRetriever extends BaseRetriever implements BaseRetrieverInterface<Record<string, any>> {
  lc_namespace = [];
  private embedder: any; // Dynamic embedding model
  
  constructor(
    private vectorStore: PineconeStore,
    embeddingModel?: any
  ) {
    super();
    this.embedder = embeddingModel || createEmbeddingModel();
  }

  async getRelevantDocuments(
    query: string, 
    options?: Partial<RunnableConfig>, 
    imageUrls: string[] = []
  ): Promise<DocumentInterface<Record<string, any>>[]> {
    // Create embedding ONCE at the beginning 
    let queryEmbedding: number[];
    let userImageBase64Data: string[] = [];
    
    if (isCohereProvider() && imageUrls.length > 0) {
      // Keep original embedding logic for RAG compatibility
      queryEmbedding = await createCohereImageOnlyEmbedding(imageUrls);
      
      // Log embedding dimensions
      const expectedDims = getModelDimensions();
      console.log(`✅ Expected dimensions: ${expectedDims}, actual: ${queryEmbedding.length}`);
      
      // Separately convert images to base64 for vision processing
      console.log(`🔄 Converting ${imageUrls.length} user images to base64 for vision processing`);
      for (const imageUrl of imageUrls) {
        try {
          const base64 = await convertImageUrlToBase64(imageUrl);
          userImageBase64Data.push(base64);
        } catch (error) {
          console.error('Error converting image URL to base64:', error);
        }
      }
    } else {
      try {
        console.log('🔍 Creating text embedding for query:', query.substring(0, 100));
        queryEmbedding = await this.embedder.embedQuery(query);
        console.log('✅ Text embedding created successfully');
      } catch (error) {
        console.error('❌ Error creating text embedding:', error);
        throw error;
      }
      
      // Convert image URLs to base64 for vision processing
      if (imageUrls.length > 0) {
        console.log(`🔄 Converting ${imageUrls.length} user images to base64 for vision processing`);
        for (const imageUrl of imageUrls) {
          try {
            const base64 = await convertImageUrlToBase64(imageUrl);
            userImageBase64Data.push(base64);
          } catch (error) {
            console.error('Error converting image URL to base64:', error);
          }
        }
      }
    }
    
    const { k, fetchK, lambda } = this.getMMRSettings();
    
    // Regular document search - exclude on-demand user image embeddings
    const regularFilter = {
      $and: [
        {
          $or: [
            { isPublic: true },
            { isPublic: { $exists: false } }
          ]
        },
        {
          source: { $ne: 'chat_conversation' }  // Exclude on-demand user image embeddings
        }
      ]
    };
    
    const mmrOptions: MaxMarginalRelevanceSearchOptions<any> = {
      k: k,
      fetchK: fetchK,
      lambda: lambda,
      filter: regularFilter
    };
    
    // Single optimized search with moderate k to avoid memory issues
    const optimizedK = Math.max(mmrOptions.k || 10, 15); // Moderate increase for variety while avoiding memory issues
    const allResults = await this.vectorStore.similaritySearchVectorWithScore(
      queryEmbedding, 
      optimizedK,
      mmrOptions.filter
    );
    
    console.log(`🔍 Single search: ${allResults.length} documents found`);
    // Reduced logging to avoid memory issues with large content
    allResults.slice(0, 10).forEach(([doc, score], index) => {
      console.log(`  ${index + 1}. Type: ${doc.metadata?.type || 'unknown'}, Score: ${score.toFixed(4)}, Content: ${doc.pageContent.substring(0, 50)}...`);
    });
    if (allResults.length > 10) {
      console.log(`  ... and ${allResults.length - 10} more results`);
    }
    
    // Filter by score threshold to include relevant results
    const SIMILARITY_THRESHOLD = 0.35; // Lower threshold to include more variety
    const filteredResults = allResults.filter(([doc, score]) => score >= SIMILARITY_THRESHOLD);
    
    console.log(`🔍 After threshold filter (≥${SIMILARITY_THRESHOLD}): ${filteredResults.length} results`);
    
    // Take top results
    const maxResults = mmrOptions.k || 10;
    const finalResults = filteredResults.slice(0, maxResults);
    
    console.log(`✅ Final results returned: ${finalResults.length}`);
    finalResults.forEach(([doc, score], index) => {
      console.log(`  Final ${index + 1}. Type: ${doc.metadata?.type || 'unknown'}, Score: ${score.toFixed(4)}`);
    });
    
    // Convert to documents and return
    const documents = finalResults.map(([doc, score]) => {
      // Parse page_image_urls if it's stored as a string
      let parsedMetadata = { ...doc.metadata };
      if (parsedMetadata.page_image_urls && typeof parsedMetadata.page_image_urls === 'string') {
        try {
          parsedMetadata.page_image_urls = JSON.parse(parsedMetadata.page_image_urls);
        } catch (e) {
          console.error('Failed to parse page_image_urls:', e);
        }
      }

      return {
        ...doc,
        metadata: { ...parsedMetadata, score, userImageBase64Data }
      };
    });

    return documents;
  }
  async invoke(input: string, options?: Partial<RunnableConfig>, imageUrls: string[] = []): Promise<DocumentInterface<Record<string, any>>[]> {
    return await this.getRelevantDocuments(input, options, imageUrls);
  }
  
  private getMMRSettings(): { k: number, fetchK: number, lambda: number } {
    return {
      k: this.getEnvironmentSetting('K_EMBEDDINGS', 8),
      fetchK: this.getEnvironmentSetting('FETCH_K_EMBEDDINGS', 12),
      lambda: parseFloat(process.env['LAMBDA_EMBEDDINGS'] || '0.1')
    };
  }

  private getEnvironmentSetting(variable: string, defaultValue: number): number {
    const value = Number(process.env[variable]);
    return isNaN(value) ? defaultValue : value;
  }

  async filteredSimilaritySearch(
    queryVector: number[], 
    type: string, 
    limit: number, 
    minScore: number
  ): Promise<SearchResult[]> {
    try {
      const filter = { 
        type: type,
        $or: [
          { isPublic: true },
          { isPublic: { $exists: false } }
        ]
      };
      
      const results: SearchResult[] = await this.vectorStore.similaritySearchVectorWithScore(
        queryVector, 
        limit, 
        filter
      );
      
      const filteredResults = results.filter(([_, score]: SearchResult) => score >= minScore);
      
      return filteredResults;
    } catch (error) {
      console.error(`Error in filteredSimilaritySearch for type ${type}:`, error);
      return [];
    }
  }

  // New method: Image-only similarity search for visual content
  async searchByImageSimilarity(
    imageUrls: string[],
    limit: number = 10,
    minScore: number = 0.5
  ): Promise<SearchResult[]> {
    if (!isCohereProvider()) {
      return [];
    }

    if (!imageUrls || imageUrls.length === 0) {
      return [];
    }

    try {
      const { createCohereImageOnlyEmbedding } = await import('./embeddingProviders');
      const imageEmbedding = await createCohereImageOnlyEmbedding(imageUrls);
      
      // Log embedding dimensions
      const expectedDims = getModelDimensions();
      console.log(`✅ Expected dimensions: ${expectedDims}, actual: ${imageEmbedding.length}`);
      
      const results: SearchResult[] = await this.vectorStore.similaritySearchVectorWithScore(
        imageEmbedding,
        limit,
        {
          $or: [
            { isPublic: true },
            { isPublic: { $exists: false } }
          ]
        }
      );

      const filteredResults = results.filter(([_, score]) => score >= minScore);
      return filteredResults;
    } catch (error) {
      console.error('Error in image similarity search:', error);
      return [];
    }
  }
}
/**
 * Utility function to stream final answer with natural timing
 */
async function streamFinalAnswer(text: string, onTokenCallback: (token: string) => void): Promise<void> {
  const words = text.split(' ');
  for (const word of words) {
    onTokenCallback(word + ' ');
    await new Promise(resolve => setTimeout(resolve, 30)); // Natural delay for better UX
  }
}

function createSnippet(content: string, maxLength = 220): string {
  if (!content) return '';
  const cleaned = content.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLength - 3)}...`;
}

// Main function to make the chain for SSE
export const makeChainSSE = (
  vectorstore: PineconeStore, 
  onTokenStream: (token: string) => void, 
  userEmail: string,
  embeddingModel?: any // Optional embedding model parameter
) => {
  // Create shared model instances
  const sharedModel = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: ENV.TEMPERATURE,
    verbose: false,
  });

  const qaPrompt = ChatPromptTemplate.fromMessages([
    ["system", qaSystemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  // Initialize custom retriever with passed embedding model
  const customRetriever = new CustomRetriever(vectorstore, embeddingModel);

  return {
    call: async (
      input: string, 
      Documents: MyDocument[], 
      roomId: string, 
      userEmail: string, 
      imageUrls: string[]
    ) => {
      await ensureChatSession(roomId, userEmail);

      // Generate a unique ID for this Q&A
      const qaId = generateUniqueId();

      // Always disable streaming - we'll handle final answer streaming manually for consistency
      const streamingModel = createChatModel('openai', {
        streaming: false, // Always disabled - we stream final answer manually
        verbose: true,
        maxTokens: 4000,
        callbacks: [], // No streaming callbacks - final answer will be streamed manually
      });

      // Process images first (if any)
      let imageDescription = '';
      if (imageUrls && imageUrls.length > 0 && !isCohereProvider()) {
        // Only process images with OpenAI if NOT using Cohere
        const { processImageWithOpenAI } = await import('./inputProcessing');
        imageDescription = await processImageWithOpenAI(imageUrls, input);
      }

      const rawChatHistory = await MemoryService.getChatHistory(roomId);
      let isFirstMessage = rawChatHistory.length === 0;

      // Custom logic to treat a single greeting message as a "first message" for title generation
      if (!isFirstMessage && rawChatHistory.length === 1) {
        const firstMessageContent = rawChatHistory[0].content?.toString().trim().toLowerCase();
        if (firstMessageContent === 'hi') {
          isFirstMessage = true;
        }
      }

      // Get optimized relevant history for contextualization
      const relevantHistory = await getRelevantHistory(rawChatHistory, input, {
        maxTurns: 3,
        useSemanticSearch: false,
        recencyWeight: 0.7
      });

      // CONSOLIDATED LLM CALL - replaces language detection, translation, contextualization, and title generation
      const {
        detectedLanguage: language,
        translatedQuestion: processedInput,
        contextualizedQuestion,
        conversationTitle: generatedTitleFromLLM
      } = await processInputConsolidated(
        input,
        relevantHistory,
        isFirstMessage,
        sharedModel
      );

      let generatedTitle = generatedTitleFromLLM; // Initialize with LLM's output

      const originalInput = input;
      
      console.log(`🌐 Detected language: ${language}`);
      console.log(`📝 Original question: "${originalInput}"`);
      console.log(`🔤 Translated question: "${processedInput}"`);
      console.log(`🔄 AI Contextualized question: "${contextualizedQuestion}"`);
      console.log(`📊 Chat history length: ${relevantHistory.length} messages`);

      if (isFirstMessage && (!generatedTitle || generatedTitle.trim() === '')) {
        generatedTitle = "New Chat"; // Fallback title for first message if LLM doesn't generate one
      }

      if (generatedTitle) {
        console.log(`📝 Generated title: "${generatedTitle}"`);
      }

      // Handle image description integration (similar to prepareInput logic)
      let finalProcessedInput = processedInput;
      if (imageDescription && !isCohereProvider()) {
        finalProcessedInput = `${processedInput} [Image model answer: ${imageDescription}]`;
      }

      // Handle historical images (if no current images but history exists)
      if (imageUrls.length === 0 && !isCohereProvider()) {
        const { getImageUrlsFromHistory, isQuestionRelatedToImage } = await import('./inputProcessing');
        const historyImageUrls = await getImageUrlsFromHistory(roomId);
        if (historyImageUrls.length > 0) {
          const relatedToImage = await isQuestionRelatedToImage(
            processedInput,
            rawChatHistory,
            sharedModel,
            imageDescription
          );

          if (relatedToImage) {
            const { processImageWithOpenAI } = await import('./inputProcessing');
            const historicalImageDescription = await processImageWithOpenAI(
              historyImageUrls,
              processedInput
            );

            if (historicalImageDescription) {
              finalProcessedInput = `${processedInput} [Image model answer: ${historicalImageDescription}]`;
              imageDescription = historicalImageDescription;
            }
          }
        }
      }

      // Create history-aware retriever with image support
      // Since we already have the contextualized question, we can bypass the history-aware logic
      const historyAwareRetriever = {
        ...customRetriever,
        invoke: async (input: string, config?: any) => {
          // Use the pre-contextualized question for retrieval
          return await customRetriever.getRelevantDocuments(contextualizedQuestion, config, imageUrls);
        },
        getRelevantDocuments: async (input: string, config?: any) => {
          // Use the pre-contextualized question for retrieval
          return await customRetriever.getRelevantDocuments(contextualizedQuestion, config, imageUrls);
        }
      };
      
      // Create QA chain with OpenAI prompt
      const questionAnswerChain = await createStuffDocumentsChain({
        llm: streamingModel as any,
        prompt: qaPrompt as any,
      });

      // Retrieve relevant documents directly
      const ragDocuments = await historyAwareRetriever.getRelevantDocuments(
        contextualizedQuestion,
        undefined
      );

      // Attempt graph augmentation if schema is available
      const schemaDoc = await getSchemaCache();
      const schemaAvailable = !!schemaDoc?.schema_data;
      const graphAugmentation = schemaAvailable
        ? await generateGraphAugmentation({
            question: contextualizedQuestion,
            llm: sharedModel,
            schemaDoc
          })
        : null;

      if (graphAugmentation) {
        const graphDoc = new MyDocument({
          pageContent: graphAugmentation.summary,
          metadata: {
            source: 'neo4j_graph',
            type: 'graph',
            score: 1,
            cypher: graphAugmentation.cypher,
            row_count: graphAugmentation.rowCount,
            execution_time_ms: graphAugmentation.executionTimeMs,
            domain: graphAugmentation.domain
          }
        });

        Documents.unshift(graphDoc);
        ragDocuments.unshift({
          pageContent: graphDoc.pageContent,
          metadata: graphDoc.metadata
        } as any);

        console.log(`🧠 Graph augmentation added (${graphAugmentation.rowCount} rows, domain: ${graphAugmentation.domain})`);
      }

      for (const doc of ragDocuments) {
        if (doc.metadata?.isPublic === false) {
          continue;
        }

        if (language === 'English' && (doc.metadata?.type === 'other' || doc.metadata?.type === 'vbs')) {
          continue;
        }

        if (language !== 'English' && (doc.metadata?.type === 'txt' || doc.metadata?.type === 'user_input')) {
          continue;
        }

        const myDoc = new MyDocument({
          pageContent: doc.pageContent,
          metadata: {
            source: doc.metadata?.source,
            type: doc.metadata?.type,
            videoLink: doc.metadata?.videoLink,
            file: doc.metadata?.file,
            score: doc.metadata?.score,
            image: doc.metadata?.image,
            pdf_source: doc.metadata?.pdf_source,
            page_number: doc.metadata?.page_number,
            page_numbers: doc.metadata?.page_numbers,
            video_url: doc.metadata?.video_url,
            video_name: doc.metadata?.video_name,
            duration_seconds: doc.metadata?.duration_seconds,
            chatbot_id: doc.metadata?.chatbot_id,
            user_id: doc.metadata?.user_id,
          },
        });

        Documents.push(myDoc);
      }

      Documents.sort((a, b) => {
        const scoreA = a.metadata.score || 0;
        const scoreB = b.metadata.score || 0;
        return scoreB - scoreA;
      });

      const embeddingDocsForContext = Documents.filter(doc => doc.metadata?.type !== 'graph');
      const graphDocsForContext = Documents.filter(doc => doc.metadata?.type === 'graph');

      const embeddingsSection = embeddingDocsForContext.length
        ? `Embeddings:\n${embeddingDocsForContext
            .map((doc, index) => {
              const source = doc.metadata?.source || doc.metadata?.file || `Document ${index + 1}`;
              const content = doc.pageContent ?? '';
              return `- ${source}:\n${content}`;
            })
            .join('\n\n')}`
        : '';

      const graphSection = graphDocsForContext.length
        ? `Graph_RAG:\n${graphDocsForContext.map(doc => doc.pageContent).join('\n\n')}`
        : '';

      const combinedContext = [embeddingsSection, graphSection].filter(Boolean).join('\n\n');

      const combinedContextDocs = combinedContext
        ? [{ pageContent: combinedContext, metadata: { source: 'combined', type: 'combined' } }]
        : ragDocuments;

      const baseAnswer = await questionAnswerChain.invoke({
        input: finalProcessedInput,
        chat_history: relevantHistory as any,
        context: combinedContextDocs,
        language,
        imageDescription,
      });

      let enhancedAnswer = typeof baseAnswer === 'string'
        ? baseAnswer
        : ((baseAnswer as any)?.answer ?? baseAnswer);

      let finalImageDescription = imageDescription;
      let visionProcessingCompleted = false; // Track if vision gave us an answer

      // Log all embedding results with full details
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 EMBEDDING SEARCH RESULTS - Total Documents: ${ragDocuments.length}`);
      console.log(`${'='.repeat(80)}\n`);

      ragDocuments.forEach((doc, index) => {
        console.log(`📄 Document ${index + 1}/${ragDocuments.length}:`);
        console.log(`   ├─ Score: ${doc.metadata?.score?.toFixed(4) || 'N/A'}`);
        console.log(`   ├─ Type: ${doc.metadata?.type || 'unknown'}`);
        console.log(`   ├─ Source: ${doc.metadata?.source || 'N/A'}`);
        console.log(`   ├─ Content: "${doc.pageContent?.substring(0, 150).replace(/\n/g, ' ') || 'N/A'}..."`);
        console.log(`   ├─ Images:`);
        console.log(`   │  ├─ page_image_url: ${doc.metadata?.page_image_url ? '✅ ' + doc.metadata.page_image_url : '❌'}`);
        console.log(`   │  ├─ image_path: ${doc.metadata?.image_path ? '✅ ' + doc.metadata.image_path : '❌'}`);
        console.log(`   │  ├─ image: ${doc.metadata?.image ? '✅ ' + doc.metadata.image : '❌'}`);
        console.log(`   │  └─ image_urls: ${doc.metadata?.image_urls ? `✅ (${doc.metadata.image_urls.length} images)` : '❌'}`);
        if (doc.metadata?.image_urls && doc.metadata.image_urls.length > 0) {
          doc.metadata.image_urls.forEach((url: string, idx: number) => {
            console.log(`   │     └─ [${idx + 1}]: ${url}`);
          });
        }
        console.log(`   └─ All Metadata Keys: ${Object.keys(doc.metadata || {}).join(', ')}`);
        console.log('');
      });

      console.log(`${'='.repeat(80)}\n`);

      // Enhanced Vision Processing for Cohere Provider with RAG context (Jina-style)
      // If first result is an image with score > 0.52, use multi-image context matching
      if (isCohereProvider() && ragDocuments.length > 0 &&
          ragDocuments[0].metadata?.type === 'image' &&
          (ragDocuments[0].metadata?.score || 0) > 0.52) {
        try {
          console.log(`\n${'='.repeat(80)}`);
          console.log(`🖼️ ENHANCED VISION PROCESSING TRIGGERED`);
          console.log(`${'='.repeat(80)}`);
          console.log(`First document type: image`);
          console.log(`First document score: ${ragDocuments[0].metadata?.score?.toFixed(4)}`);
          console.log(`${'='.repeat(80)}\n`);

          const contextImageUrls: string[] = [];
          const firstImageDoc = ragDocuments[0];

          // Step 1: Get the matched content image (the specific diagram/photo that scored high)
          if (firstImageDoc.metadata?.image_path) {
            contextImageUrls.push(firstImageDoc.metadata.image_path);
            console.log(`📸 Content image (matched): ${firstImageDoc.metadata.image_path.substring(0, 80)}...`);
          } else if (firstImageDoc.metadata?.image) {
            contextImageUrls.push(firstImageDoc.metadata.image);
            console.log(`📸 Content image (matched): ${firstImageDoc.metadata.image.substring(0, 80)}...`);
          }

          // Step 2: Try to get the page screenshot for full context
          // Option A: If this image chunk has page_image_urls in its metadata
          if (firstImageDoc.metadata?.page_image_urls && Array.isArray(firstImageDoc.metadata.page_image_urls) && firstImageDoc.metadata.page_image_urls.length > 0) {
            const pageScreenshot = firstImageDoc.metadata.page_image_urls[0];
            contextImageUrls.push(pageScreenshot);
            console.log(`📄 Page screenshot (from image chunk): ${pageScreenshot.substring(0, 80)}...`);
          }
          // Option B: Find the parent text chunk and get its page screenshot
          else if (firstImageDoc.metadata?.parent_chunk_id) {
            const parentChunkId = firstImageDoc.metadata.parent_chunk_id;
            console.log(`🔍 Looking for parent chunk: ${parentChunkId}`);

            const parentChunk = ragDocuments.find(doc => doc.metadata?.chunk_id === parentChunkId);
            if (parentChunk && parentChunk.metadata?.page_image_urls && Array.isArray(parentChunk.metadata.page_image_urls) && parentChunk.metadata.page_image_urls.length > 0) {
              const pageScreenshot = parentChunk.metadata.page_image_urls[0];
              contextImageUrls.push(pageScreenshot);
              console.log(`📄 Page screenshot (from parent chunk): ${pageScreenshot.substring(0, 80)}...`);
            } else {
              console.log(`⚠️ Parent chunk found but no page_image_urls available`);
            }
          }
          // Option C: Check if first doc is actually a text chunk with page screenshots
          else if (firstImageDoc.metadata?.type === 'text' && firstImageDoc.metadata?.page_image_urls && Array.isArray(firstImageDoc.metadata.page_image_urls) && firstImageDoc.metadata.page_image_urls.length > 0) {
            const pageScreenshot = firstImageDoc.metadata.page_image_urls[0];
            contextImageUrls.push(pageScreenshot);
            console.log(`📄 Page screenshot (from text chunk): ${pageScreenshot.substring(0, 80)}...`);
          }

          // Get user image base64 data from the first document's metadata
          const userImageBase64Data = firstImageDoc.metadata?.userImageBase64Data || [];

          console.log(`\n📊 Images Summary:`);
          console.log(`   Context Images: ${contextImageUrls.length}`);
          contextImageUrls.forEach((url, idx) => {
            const isScreenshot = url.includes('_screenshot.');
            console.log(`   ${idx + 1}. ${isScreenshot ? '📄 Page Screenshot' : '📸 Content Image'}: ${url.substring(0, 80)}...`);
          });
          console.log(`   User Images: ${userImageBase64Data.length}`);
          console.log('');

          if (contextImageUrls.length > 0 || userImageBase64Data.length > 0) {
            console.log(`🔍 Processing with GPT-4o: ${contextImageUrls.length} context + ${userImageBase64Data.length} user images`);

            // Call enhanced vision processing using processImagesWithContext (GPT-4o)
            const { processImagesWithContext } = await import('./inputProcessing');
            const visionAnswer = await processImagesWithContext(
              userImageBase64Data,
              contextImageUrls,
              originalInput,
              'gpt-4o' // Use GPT-4o for sophisticated multi-image analysis
            );

            if (visionAnswer && visionAnswer.trim() !== '') {
              enhancedAnswer = visionAnswer;
              visionProcessingCompleted = true; // Mark that vision provided the answer
              console.log(`\n${'='.repeat(80)}`);
              console.log(`✅ ENHANCED VISION PROCESSING COMPLETED`);
              console.log(`${'='.repeat(80)}`);
              console.log(`📝 Vision Answer:`);
              console.log(enhancedAnswer);
              console.log(`${'='.repeat(80)}\n`);
            }
          } else {
            console.log('⚠️ No images available for vision processing');
          }
        } catch (error) {
          console.error('❌ Error in enhanced vision processing:', error);
          // Fallback to regular vision processing
          try {
            if (imageUrls && imageUrls.length > 0) {
              const { processImageWithOpenAI } = await import('./inputProcessing');
              const fallbackAnswer = await processImageWithOpenAI(imageUrls, originalInput);
              if (fallbackAnswer && fallbackAnswer.trim() !== '') {
                enhancedAnswer = fallbackAnswer;
                visionProcessingCompleted = true; // Mark that fallback vision provided the answer
              }
            }
          } catch (fallbackError) {
            console.error('Error in fallback vision processing:', fallbackError);
            // Keep original RAG answer
          }
        }
      }

      // Only run regular QA chain if vision processing didn't provide an answer
      if (combinedContextDocs.length > 0 && !visionProcessingCompleted) {
        const finalAnswerResult = await questionAnswerChain.invoke({
          input: finalProcessedInput,
          chat_history: relevantHistory as any,
          context: combinedContextDocs,
          language,
          imageDescription: finalImageDescription,
        });

        enhancedAnswer = typeof finalAnswerResult === 'string'
          ? finalAnswerResult
          : ((finalAnswerResult as any)?.answer ?? finalAnswerResult);
      } else if (visionProcessingCompleted) {
        console.log('✅ Skipping regular QA chain - using vision processing result');
      }

      // Store the Q&A in the database
      const db = new TenantDB();
      await db.insertQA(
        originalInput, 
        enhancedAnswer, 
        combinedContextDocs, 
        Documents, 
        qaId, 
        roomId, 
        userEmail, 
        imageUrls, 
        language, 
        'openai',
        contextualizedQuestion
      );

      // Update chat memory
      await updateConversationMemory(
        roomId,
        originalInput,
        enhancedAnswer,
        imageUrls,
        userEmail,
        Documents,
        qaId,
        generatedTitle || undefined,
        language
      );

      // Stream the final answer with consistent timing
      console.log('🔄 Streaming final answer...');
      await streamFinalAnswer(enhancedAnswer, onTokenStream);
      console.log('✅ Final answer streaming completed');

      // Return the result instead of emitting via socket
      return {
        answer: enhancedAnswer,
        qaId: qaId,
        sourceDocs: Documents,
        graph: graphAugmentation
          ? {
              cypher: graphAugmentation.cypher,
              domain: graphAugmentation.domain,
              rowCount: graphAugmentation.rowCount,
              executionTimeMs: graphAugmentation.executionTimeMs,
              rowsPreview: graphAugmentation.rows.slice(0, 5)
            }
          : null,
        schemaAvailable
      };
    },
    vectorstore,
  };
};
