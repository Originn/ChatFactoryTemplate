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
 * Create embeddings on-demand for images if they don't exist in Pinecone
 */
async function ensureImageEmbeddingsExist(
  imageUrls: string[],
  userEmail: string
): Promise<void> {
  if (!isCohereProvider() || !imageUrls || imageUrls.length === 0) {
    return;
  }

  try {
    console.log(`🔍 Creating on-demand embeddings for ${imageUrls.length} image(s)`);
    
    // Generate image-only embedding
    const embedding = await createCohereImageOnlyEmbedding(imageUrls);

    if (!embedding || embedding.length === 0) {
      console.warn('⚠️ No embedding generated for images');
      return;
    }

    // Validate embedding dimensions match expected
    const expectedDims = getModelDimensions();
    console.log(`✅ Expected dimensions: ${expectedDims}, actual: ${embedding.length}`);

    console.log(`✅ Generated IMAGE-ONLY embedding with ${embedding.length} dimensions`);

    // Prepare metadata
    const timestamp = new Date().toISOString();
    const embeddingId = `user_image_${uuidv4()}`;
    const contextText = `User uploaded ${imageUrls.length} image(s) during conversation at ${timestamp}`;

    const metadata = {
      content_type: 'user_uploaded_image',
      user_email: userEmail,
      upload_timestamp: timestamp,
      embedding_id: embeddingId,
      image_count: imageUrls.length,
      image_urls: imageUrls,
      context_text: contextText,
      embedding_type: 'image_only',
      source: 'chat_conversation',
      embedding_provider: 'cohere',
      embedding_model: process.env.EMBEDDING_MODEL || 'embed-v4.0',
      embedding_dimensions: embedding.length,
      embedding_task: 'retrieval.query'
    };

    // Store in Pinecone directly (we're already in server context)
    const { getPinecone } = await import('./pinecone-client');
    const { PINECONE_NAME_SPACE } = await import('../config/pinecone');
    
    const pinecone = getPinecone();
    const namespace = PINECONE_NAME_SPACE || 'default';
    
    await pinecone.namespace(namespace).upsert([{
      id: embeddingId,
      values: embedding,
      metadata: metadata
    }]);

    console.log(`✅ On-demand embedding stored in Pinecone: ${embeddingId}`);

  } catch (error) {
    console.error('❌ Error creating on-demand embeddings:', error);
    // Continue without embeddings - don't block the conversation
  }
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
    const documents = finalResults.map(([doc, score]) => ({
      ...doc,
      metadata: { ...doc.metadata, score, userImageBase64Data }
    }));
    
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
      
      // Create embeddings on-demand for any images in the conversation
      await ensureImageEmbeddingsExist(imageUrls, userEmail);
      
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

      // Vision-first logic: If first result is an image with score > 0.52, analyze it with GPT-4o-mini vision
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🖼️ VISION-FIRST ANALYSIS CHECK`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Documents available: ${ragDocuments.length}`);
      if (ragDocuments.length > 0) {
        console.log(`First document type: ${ragDocuments[0].metadata?.type || 'N/A'}`);
        console.log(`First document score: ${ragDocuments[0].metadata?.score?.toFixed(4) || 'N/A'}`);
        console.log(`Score threshold: 0.52`);
        console.log(`Should trigger vision: ${ragDocuments[0].metadata?.type === 'image' && (ragDocuments[0].metadata?.score || 0) > 0.52 ? '✅ YES' : '❌ NO'}`);
      }
      console.log(`${'='.repeat(80)}\n`);

      let enhancedImageDescription = imageDescription;
      if (ragDocuments.length > 0 &&
          ragDocuments[0].metadata?.type === 'image' &&
          (ragDocuments[0].metadata?.score || 0) > 0.52) {
        try {
          console.log('🖼️ ✅ VISION-FIRST TRIGGERED - First result is an image with score > 0.52');
          const firstImageDoc = ragDocuments[0];

          // Extract image URL from the first document
          let imageUrl = null;
          let sourceField = null;
          if (firstImageDoc.metadata?.page_image_url) {
            imageUrl = firstImageDoc.metadata.page_image_url;
            sourceField = 'page_image_url';
          } else if (firstImageDoc.metadata?.image_path) {
            imageUrl = firstImageDoc.metadata.image_path;
            sourceField = 'image_path';
          } else if (firstImageDoc.metadata?.image) {
            imageUrl = firstImageDoc.metadata.image;
            sourceField = 'image';
          } else if (firstImageDoc.metadata?.source) {
            imageUrl = firstImageDoc.metadata.source;
            sourceField = 'source';
          }

          console.log(`📍 Image URL source field: ${sourceField || 'NONE'}`);
          console.log(`📍 Image URL: ${imageUrl || 'NO URL FOUND'}`);

          if (imageUrl) {
            // Convert to signed URL if it's a storage URL
            let accessibleImageUrl = imageUrl;
            try {
              const { convertToSignedUrlIfNeeded } = await import('./inputProcessing');
              accessibleImageUrl = await convertToSignedUrlIfNeeded(imageUrl);
              console.log(`✅ Signed URL generated successfully`);
              console.log(`🔗 Signed URL: ${accessibleImageUrl}`);
            } catch (urlError) {
              console.error('⚠️ Failed to generate signed URL, using original URL:', urlError);
            }

            // Create a vision model for analyzing the image
            console.log(`🤖 Creating GPT-4o-mini vision model...`);
            const visionModel = new ChatOpenAI({
              streaming: false,
              verbose: false,
              maxTokens: 500,
              modelName: 'gpt-4o-mini', // Using 4o-mini for vision
              openAIApiKey: process.env.OPENAI_API_KEY,
            });

            // Analyze the image with the user's question
            console.log(`🔍 Invoking vision model with question: "${contextualizedQuestion}"`);
            const visionResponse = await visionModel.invoke([
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Please analyze this image in relation to the user's question: "${contextualizedQuestion}". Provide a short and concise description of what you see that's relevant to answering their question.`
                  },
                  {
                    type: 'image_url',
                    image_url: { url: accessibleImageUrl }
                  }
                ]
              }
            ]);

            if (visionResponse && visionResponse.content) {
              enhancedImageDescription = typeof visionResponse.content === 'string'
                ? visionResponse.content
                : JSON.stringify(visionResponse.content);
              finalImageDescription = enhancedImageDescription; // Update final image description

              console.log(`\n${'='.repeat(80)}`);
              console.log(`✅ VISION ANALYSIS COMPLETED`);
              console.log(`${'='.repeat(80)}`);
              console.log(`📝 Full Vision Description:`);
              console.log(enhancedImageDescription);
              console.log(`${'='.repeat(80)}\n`);

              // Re-generate answer with enhanced image description using same documents (no new retrieval)
              console.log('🔄 Re-generating answer with enhanced image description...');
              const regeneratedAnswer = await questionAnswerChain.invoke({
                input: processedInput,
                chat_history: relevantHistory as any,
                context: ragDocuments, // Use same retrieved documents
                language,
                imageDescription: enhancedImageDescription, // Use enhanced description
              });

              // Update enhanced answer for final output
              enhancedAnswer = typeof regeneratedAnswer === 'string'
                ? regeneratedAnswer
                : ((regeneratedAnswer as any)?.answer ?? regeneratedAnswer);

              console.log(`\n${'='.repeat(80)}`);
              console.log(`✅ ENHANCED ANSWER GENERATED`);
              console.log(`${'='.repeat(80)}`);
              console.log(`📝 Enhanced Answer:`);
              console.log(enhancedAnswer);
              console.log(`${'='.repeat(80)}\n`);
            }
          } else {
            console.log('⚠️ No image URL found in first document metadata - skipping vision analysis');
          }
        } catch (error) {
          console.error('❌ Error in vision-first analysis:', error);
          console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
          // Continue with original imageDescription on error
        }
      } else {
        console.log('⏭️ Vision-first analysis SKIPPED - conditions not met');
      }

      if (combinedContextDocs.length > 0) {
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
