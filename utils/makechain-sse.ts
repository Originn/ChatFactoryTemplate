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
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createChatModel } from './modelProviders';
import { getRelevantHistory } from './contextManager';
import { createEmbeddingModel } from './embeddingProviders';
import { isJinaProvider, createJinaMultimodalEmbedding, createJinaImageOnlyEmbedding, createJinaMultimodalEmbeddingWithBase64, convertImageUrlToBase64 } from './embeddingProviders';
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
  if (!isJinaProvider() || !imageUrls || imageUrls.length === 0) {
    return;
  }

  try {
    console.log(`🔍 Creating on-demand embeddings for ${imageUrls.length} image(s)`);
    
    // Generate image-only embedding
    const embedding = await createJinaImageOnlyEmbedding(imageUrls);

    if (!embedding || embedding.length === 0) {
      console.warn('⚠️ No embedding generated for images');
      return;
    }

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
      embedding_provider: 'jina',
      embedding_model: process.env.EMBEDDING_MODEL || 'jina-embeddings-v4',
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
    
    if (isJinaProvider() && imageUrls.length > 0) {
      // Keep original embedding logic for RAG compatibility
      queryEmbedding = await createJinaImageOnlyEmbedding(imageUrls);
      
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
      
      // For non-Jina providers, manually convert image URLs to base64 for vision processing
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
    
    // Regular document search
    const regularFilter = {
      $or: [
        { isPublic: true },
        { isPublic: { $exists: false } }
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
    if (!isJinaProvider()) {
      return [];
    }

    if (!imageUrls || imageUrls.length === 0) {
      return [];
    }

    try {
      const { createJinaImageOnlyEmbedding } = await import('./embeddingProviders');
      const imageEmbedding = await createJinaImageOnlyEmbedding(imageUrls);
      
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
        verbose: false,
        maxTokens: 4000,
        callbacks: [], // No streaming callbacks - final answer will be streamed manually
      });

      // Process images first (if any)
      let imageDescription = '';
      if (imageUrls && imageUrls.length > 0 && !isJinaProvider()) {
        // Only process images with OpenAI if NOT using Jina
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
      if (imageDescription && !isJinaProvider()) {
        finalProcessedInput = `${processedInput} [Image model answer: ${imageDescription}]`;
      }

      // Handle historical images (if no current images but history exists)
      if (imageUrls.length === 0 && !isJinaProvider()) {
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

      // Create RAG chain
      const ragChain = await createRetrievalChain({
        retriever: historyAwareRetriever as any,
        combineDocsChain: questionAnswerChain,
      });

      // Invoke RAG chain to get answer
      const ragResponse = await ragChain.invoke({
        input: finalProcessedInput,
        chat_history: relevantHistory as any,
        language,
        imageDescription,
      });

      // Process documents from RAG response
      const ragDocuments = ragResponse.context || [];
      
      // Vision-first logic: If first result is an image with score > 0.53, analyze it with GPT-4o-mini vision
      let enhancedImageDescription = imageDescription;
      if (ragDocuments.length > 0 && 
          ragDocuments[0].metadata?.type === 'image' && 
          (ragDocuments[0].metadata?.score || 0) > 0.53) {
        try {
          console.log('🖼️ First result is an image - triggering vision-first analysis');
          const firstImageDoc = ragDocuments[0];
          
          // Extract image URL from the first document
          let imageUrl = null;
          if (firstImageDoc.metadata?.page_image_url) {
            imageUrl = firstImageDoc.metadata.page_image_url;
          } else if (firstImageDoc.metadata?.image) {
            imageUrl = firstImageDoc.metadata.image;
          } else if (firstImageDoc.metadata?.source) {
            imageUrl = firstImageDoc.metadata.source;
          }
          
          if (imageUrl) {
            console.log(`🔍 Analyzing image with GPT-4o-mini: ${imageUrl.substring(0, 80)}...`);
            
            // Convert to signed URL if it's a storage URL
            let accessibleImageUrl = imageUrl;
            try {
              const { convertToSignedUrlIfNeeded } = await import('./inputProcessing');
              accessibleImageUrl = await convertToSignedUrlIfNeeded(imageUrl);
              console.log(`✅ Generated signed URL for vision model`);
            } catch (urlError) {
              console.error('⚠️ Failed to generate signed URL, using original URL:', urlError);
            }
            
            // Create a vision model for analyzing the image
            const visionModel = new ChatOpenAI({
              streaming: false,
              verbose: false,
              maxTokens: 500,
              modelName: 'gpt-4o-mini', // Using 4o-mini for vision
              openAIApiKey: process.env.OPENAI_API_KEY,
            });
            
            // Analyze the image with the user's question
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
              console.log('✅ Vision analysis completed successfully');
              console.log(`📝 Vision description: ${enhancedImageDescription.substring(0, 150)}...`);
              
              // Re-generate answer with enhanced image description using same documents (no new retrieval)
              console.log('🔄 Re-generating answer with enhanced image description');
              const enhancedAnswer = await questionAnswerChain.invoke({
                input: processedInput,
                chat_history: relevantHistory as any,
                context: ragDocuments, // Use same retrieved documents
                language,
                imageDescription: enhancedImageDescription, // Use enhanced description
              });
              
              // Update the RAG response with enhanced version
              ragResponse.answer = typeof enhancedAnswer === 'string' ? enhancedAnswer : ((enhancedAnswer as any)?.answer || enhancedAnswer);
              console.log('✅ Enhanced answer generated with same documents');
            }
          }
        } catch (error) {
          console.error('❌ Error in vision-first analysis:', error);
          // Continue with original imageDescription on error
        }
      }
      
      // Set threshold for document relevance
      let minScoreSourcesThreshold = ENV.MINSCORESOURCESTHRESHOLD !== undefined ? 
        ENV.MINSCORESOURCESTHRESHOLD : 0.78;
      
      // For non-English queries, use a lower threshold
      if (language !== 'English') {
        minScoreSourcesThreshold = 0.45;
      }

      // Process and add documents to the result
      let documentsAdded = 0;
      let documentsSkipped = 0;
      
      for (const doc of ragDocuments) {
        // Filter out private documents from public chatbot
        if (doc.metadata?.isPublic === false) {
          documentsSkipped++;
          continue;
        }
        
        // Skip certain types for English queries
        if (language === 'English' && (doc.metadata?.type === 'other' || doc.metadata?.type === 'vbs')) {
          documentsSkipped++;
          continue;
        }
        
        // Skip txt and user_input types for non-English queries
        if (language !== 'English' && (doc.metadata?.type === 'txt' || doc.metadata?.type === 'user_input')) {
          documentsSkipped++;
          continue;
        }

        documentsAdded++;

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
          },
        });

        Documents.push(myDoc);
      }
      
      // Sort documents by score
      Documents.sort((a, b) => {
        const scoreA = a.metadata.score || 0;
        const scoreB = b.metadata.score || 0;
        return scoreB - scoreA;
      });

      // Enhanced Vision Processing for Jina Provider with RAG context
      let enhancedAnswer = ragResponse.answer;
      if (isJinaProvider() && imageUrls.length > 0) {
        try {
          // Extract context image URLs from retrieved documents
          const contextImageUrls: string[] = [];
          console.log(`🔍 Analyzing ${ragDocuments.length} retrieved documents for images:`);
          
          for (let i = 0; i < ragDocuments.length; i++) {
            const doc = ragDocuments[i];
            console.log(`  📄 Doc ${i + 1}:`, {
              type: doc.metadata?.type,
              score: doc.metadata?.score,
              source: doc.metadata?.source,
              hasImageUrls: !!doc.metadata?.image_urls,
              hasImage: !!doc.metadata?.image,
              hasImagePath: !!doc.metadata?.image_path,
              hasPageImageUrl: !!doc.metadata?.page_image_url,
              imageUrlsLength: doc.metadata?.image_urls?.length || 0,
              imageValue: doc.metadata?.image ? 'present' : 'absent',
              imagePathValue: doc.metadata?.image_path ? 'present' : 'absent',
              pageImageUrlValue: doc.metadata?.page_image_url ? 'present' : 'absent'
            });
            
            // First priority: Use page_image_url if available (full page context)
            if (doc.metadata?.page_image_url && typeof doc.metadata.page_image_url === 'string') {
              console.log(`    🖼️ Found page image URL: ${doc.metadata.page_image_url.substring(0, 80)}...`);
              contextImageUrls.push(doc.metadata.page_image_url);
            } else if (doc.metadata?.image_urls && Array.isArray(doc.metadata.image_urls)) {
              console.log(`    ✅ Found ${doc.metadata.image_urls.length} image URLs in image_urls array`);
              contextImageUrls.push(...doc.metadata.image_urls);
            } else if (doc.metadata?.image && typeof doc.metadata.image === 'string') {
              console.log(`    ✅ Found single image in image field: ${doc.metadata.image.substring(0, 50)}...`);
              contextImageUrls.push(doc.metadata.image);
            } else if (doc.metadata?.image_path && typeof doc.metadata.image_path === 'string') {
              console.log(`    ✅ Found image path: ${doc.metadata.image_path.substring(0, 50)}...`);
              contextImageUrls.push(doc.metadata.image_path);
            } else {
              console.log(`    ❌ No images found in this document`);
            }
          }

          // Get user image base64 data from the first document's metadata (stored during RAG)
          const userImageBase64Data = ragDocuments[0]?.metadata?.userImageBase64Data || [];

          console.log(`📊 RAG Results: Found ${ragDocuments.length} documents`);
          console.log(`🖼️ Context Images Found: ${contextImageUrls.length}`);
          console.log(`👤 User Images Available: ${userImageBase64Data.length}`);
          console.log(`🔧 Provider: ${isJinaProvider() ? 'Jina' : 'OpenAI'}`);

          if (contextImageUrls.length > 0 || userImageBase64Data.length > 0) {
            console.log(`🔍 Enhanced Vision: Processing ${contextImageUrls.length} context images + ${userImageBase64Data.length} user images`);
            
            // Call enhanced vision processing (non-streaming version)
            const visionAnswer = await processImagesWithContext(
              userImageBase64Data,
              contextImageUrls,
              originalInput
            );

            if (visionAnswer && visionAnswer.trim() !== '') {
              enhancedAnswer = visionAnswer;
              console.log('✨ Enhanced vision processing completed successfully');
            }
          } else if (userImageBase64Data.length > 0) {
            // Fallback: If no context images but user has images, use regular vision processing (non-streaming)
            console.log('📸 Fallback: Using regular vision processing for user images only');
            
            const fallbackAnswer = await processImageWithOpenAI(imageUrls, originalInput);
            if (fallbackAnswer && fallbackAnswer.trim() !== '') {
              enhancedAnswer = fallbackAnswer;
            }
          }
        } catch (error) {
          console.error('Error in enhanced vision processing:', error);
          // Fallback to regular vision processing (non-streaming)
          try {
            const fallbackAnswer = await processImageWithOpenAI(imageUrls, originalInput);
            if (fallbackAnswer && fallbackAnswer.trim() !== '') {
              enhancedAnswer = fallbackAnswer;
            }
          } catch (fallbackError) {
            console.error('Error in fallback vision processing:', fallbackError);
            // Keep original RAG answer - will be streamed at the end
          }
        }
      }

      // Store the Q&A in the database
      const db = new TenantDB();
      await db.insertQA(
        originalInput, 
        enhancedAnswer, 
        ragResponse.context, 
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
        sourceDocs: Documents
      };
    },
    vectorstore,
  };
};