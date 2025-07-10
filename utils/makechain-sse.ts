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
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createChatModel } from './modelProviders';
import { getRelevantHistory } from './contextManager';
import { createEmbeddingModel } from './embeddingProviders';
import { isJinaProvider, createJinaMultimodalEmbedding } from './embeddingProviders';
import {
  contextualizeQSystemPrompt,
  qaSystemPrompt,
  TITLE_GENERATION_PROMPT
} from './prompts/promptTemplates';
import { getTemplateConfig } from '../config/template';
import { ensureChatSession } from './chatSession';
import { prepareInput } from './inputProcessing';

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
function isApiRelatedQuery(query: string): boolean {
  return /\b(api|vbs|script|automation|calculate|automate|programming|code|operation|function)\b/i.test(query);
}

function generateUniqueId(): string {
  return uuidv4();
}
/**
 * Generate a title for a new conversation
 */
async function generateConversationTitle(
  input: string, 
  answer: string, 
  model: ChatOpenAI,
  detectedLanguage: string = 'English'
): Promise<string> {
  try {
    const config = getTemplateConfig();
    
    // For very short inputs, use a template in the detected language
    if (input.trim().length <= 5) {
      const templates: Record<string, string> = {
        'English': `New conversation about ${config.productName}`,
        'Portuguese': `Início da conversa sobre ${config.productName}`,
        'Spanish': `Inicio de conversación sobre ${config.productName}`,
        'French': `Début de conversation sur ${config.productName}`,
        'German': `Beginn des Gesprächs über ${config.productName}`,
        'Italian': `Inizio della conversazione su ${config.productName}`,
        'Chinese': `${config.productName} 对话开始`,
        'Japanese': `${config.productName} についての会話の開始`,
        'Russian': `Начало разговора о ${config.productName}`,
        'Arabic': `بداية المحادثة حول ${config.productName}`,
        'Hebrew': `תחילת שיחה על ${config.productName}`,
      };
      
      return templates[detectedLanguage] || templates['English'];
    }
    
    // For normal-length inputs, generate a custom title
    const titlePrompt = TITLE_GENERATION_PROMPT
      .replace('{input}', input)
      .replace('{answer}', answer);
      
    const titleResponse = await model.generate([[{
      role: "system",
      content: `You must generate a title in ${detectedLanguage} language. The title should reflect the content of the conversation.`
    }, {
      role: "user",
      content: titlePrompt
    }]]);
    
    return titleResponse.generations[0][0].text.trim();
  } catch (error) {
    console.error("Error generating conversation title:", error);
    return "New Conversation";
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
  existingTitle?: string,
  language: string = 'English'
): Promise<void> {
  try {
    let conversationTitle = existingTitle || '';
    
    if (!conversationTitle) {
      let existingHistory;
      try {
        const db = new TenantDB();
        existingHistory = await db.getChatHistoryByRoomId(roomId);
      } catch (error) {
        console.error('Error fetching chat history:', error);
      }
      
      const shouldGenerateNewTitle = !existingHistory || 
        (existingHistory.conversation_json.length === 1 && 
         existingHistory.conversation_json[0].type === 'userMessage' && 
         existingHistory.conversation_json[0].message === 'Hi');
      
      if (shouldGenerateNewTitle) {
        const titleModel = new ChatOpenAI({
          modelName: 'gpt-4o-mini',
          temperature: ENV.TEMPERATURE,
        });
        conversationTitle = await generateConversationTitle(originalInput, answer, titleModel, language);
      } else {
        conversationTitle = existingHistory.conversation_title;
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
    console.error(`🚨 DEBUG: CustomRetriever constructor called with embeddingModel: ${embeddingModel ? 'provided' : 'null'}`);
    this.embedder = embeddingModel || createEmbeddingModel();
    console.error(`🚨 DEBUG: CustomRetriever embedder set`);
  }

  async getRelevantDocuments(
    query: string, 
    options?: Partial<RunnableConfig>, 
    imageUrls: string[] = []
  ): Promise<DocumentInterface<Record<string, any>>[]> {
    const isApiQuery = isApiRelatedQuery(query);
    
    const { k, fetchK, lambda } = this.getMMRSettings();
    const mmrOptions: MaxMarginalRelevanceSearchOptions<any> = {
      k: k,
      fetchK: fetchK,
      lambda: lambda,
      // 🔒 SECURITY: Filter to only include public documents
      filter: {
        $or: [
          { isPublic: true },
          { isPublic: { $exists: false } } // Backward compatibility
        ]
      }
    };
    
    if (isApiQuery) {
      mmrOptions.fetchK = Math.max(mmrOptions.fetchK ?? 0, 20);
    }
    
    try {
      const mmrResults = await this.vectorStore.maxMarginalRelevanceSearch(query, mmrOptions);
      
      if (isApiQuery) {
        try {
          let queryEmbedding: number[];
          
          // Use multimodal embedding if Jina provider
          if (isJinaProvider() && imageUrls.length > 0) {
            queryEmbedding = await createJinaMultimodalEmbedding(query, imageUrls);
          } else {
            queryEmbedding = await this.embedder.embedQuery(query);
          }
          
          const vbsFilter = { 
            type: 'vbs',
            $or: [
              { isPublic: true },
              { isPublic: { $exists: false } }
            ]
          };
          const vbsResults = await this.vectorStore.similaritySearchVectorWithScore(queryEmbedding, 5, vbsFilter);
          
          if (vbsResults && vbsResults.length > 0) {
            const vbsDocs = vbsResults
              .filter(([_, score]) => score >= 0.3)
              .map(([doc, _]) => new MyDocument({
                pageContent: typeof doc === 'object' && doc !== null ? doc.pageContent : '',
                metadata: typeof doc === 'object' && doc !== null ? { ...doc.metadata } : {}
              }));
            
            if (vbsDocs.length > 0) {
              return [...vbsDocs, ...mmrResults];
            }
          }
        } catch (error) {
          console.error("Error getting VBS files:", error);
        }
      }
      
      return mmrResults;
    } catch (error) {
      console.error("Error in getRelevantDocuments:", error);
      return [];
    }
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
      // 🔒 SECURITY: Filter to only include public documents
      const filter = { 
        type: type,
        $or: [
          { isPublic: true },
          { isPublic: { $exists: false } } // Backward compatibility for documents without privacy flag
        ]
      };
      
      const results: SearchResult[] = await this.vectorStore.similaritySearchVectorWithScore(
        queryVector, 
        limit, 
        filter
      );
      return results.filter(([_, score]: SearchResult) => score >= minScore);
    } catch (error) {
      console.error(`Error in filteredSimilaritySearch for type ${type}:`, error);
      return [];
    }
  }
  async storeEmbeddings(query: string, minScoreSourcesThreshold: number, imageUrls: string[] = []) {
    try {
      let queryEmbedding: number[];
      
      // Use multimodal embedding if Jina provider
      if (isJinaProvider() && imageUrls.length > 0) {
        queryEmbedding = await createJinaMultimodalEmbedding(query, imageUrls);
      } else {
        queryEmbedding = await this.embedder.embedQuery(query);
      }
      
      const isApiQuery = isApiRelatedQuery(query);
      
      const [pdfResults, webinarResults, sentinelResults, vimeoResults, vbsResults] = await Promise.all([
        this.filteredSimilaritySearch(queryEmbedding, 'pdf', 2, minScoreSourcesThreshold),
        this.filteredSimilaritySearch(queryEmbedding, 'youtube', 2, minScoreSourcesThreshold),
        this.filteredSimilaritySearch(queryEmbedding, 'sentinel', 2, minScoreSourcesThreshold),
        this.filteredSimilaritySearch(queryEmbedding, 'vimeo', 2, minScoreSourcesThreshold),
        isApiQuery ? this.filteredSimilaritySearch(queryEmbedding, 'vbs', 5, 0.3) : Promise.resolve([])
      ]);
    
      const combinedResults = [...pdfResults, ...webinarResults, ...sentinelResults, ...vimeoResults];
      
      if (isApiQuery && vbsResults.length > 0) {
        const boostedVbsResults = vbsResults.map(([doc, score]) => {
          const boostedScore = Math.min(score * 1.4, 0.98);
          return [doc, boostedScore] as [any, number];
        });
        combinedResults.push(...boostedVbsResults);
      }
      
      return combinedResults.sort((a, b) => b[1] - a[1]);
    } catch (error) {
      console.error("Error in storeEmbeddings:", error);
      return [];
    }
  }
}
// Main function to make the chain for SSE
export const makeChainSSE = (
  vectorstore: PineconeStore, 
  onTokenStream: (token: string) => void, 
  userEmail: string
) => {
  // Create shared model instances
  const sharedModel = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: ENV.TEMPERATURE,
    verbose: false,
  });

  const translationModel = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: ENV.TEMPERATURE,
  });

  // Initialize prompt templates
  const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
    ["system", contextualizeQSystemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  const qaPrompt = ChatPromptTemplate.fromMessages([
    ["system", qaSystemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  // Initialize custom retriever with dynamic embedding model
  console.error(`🚨 DEBUG: About to call createEmbeddingModel() in makechain-sse.ts`);
  const embeddingModel = createEmbeddingModel();
  console.error(`🚨 DEBUG: Created embedding model, creating CustomRetriever...`);
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
      // Initialize streaming model with SSE callback
      console.log('[makechain-sse] Creating streaming model with callback');
      const streamingModel = createChatModel('openai', {
        streaming: true,
        verbose: false,
        maxTokens: 4000,
        callbacks: [{
          handleLLMNewToken: (token: any) => {
            console.log('[makechain-sse] Streaming token received:', token.substring(0, 20));
            // Use the provided callback instead of socket emission
            onTokenStream(token);
          },
        }],
      });
      console.log('[makechain-sse] Streaming model created');

      const {
        processedInput,
        originalInput,
        language,
        imageDescription
      } = await prepareInput(
        input,
        imageUrls,
        roomId,
        sharedModel,
        translationModel
      );

      const rawChatHistory = await MemoryService.getChatHistory(roomId);

      // Log if this is an API-related query
      const isApiQuery = isApiRelatedQuery(processedInput);

      // Create history-aware retriever
      const historyAwareRetriever = await createHistoryAwareRetriever({
        llm: sharedModel as any,
        retriever: customRetriever as any,
        rephrasePrompt: contextualizeQPrompt as any,
      });
      
      // Create QA chain with OpenAI prompt
      const questionAnswerChain = await createStuffDocumentsChain({
        llm: streamingModel as any,
        prompt: qaPrompt as any,
      });

      // Create RAG chain
      const ragChain = await createRetrievalChain({
        retriever: historyAwareRetriever,
        combineDocsChain: questionAnswerChain,
      });
      // Get optimized relevant history
      const relevantHistory = await getRelevantHistory(rawChatHistory, processedInput, {
        maxTurns: 3,
        useSemanticSearch: false,
        recencyWeight: 0.7
      });

      // Invoke RAG chain to get answer
      console.log('[makechain-sse] Invoking RAG chain...');
      const ragResponse = await ragChain.invoke({
        input: processedInput,
        chat_history: relevantHistory as any,
        language,
        imageDescription,
      });
      console.log('[makechain-sse] RAG chain completed, answer length:', ragResponse.answer.length);

      // Set threshold for document relevance
      let minScoreSourcesThreshold = ENV.MINSCORESOURCESTHRESHOLD !== undefined ? 
        ENV.MINSCORESOURCESTHRESHOLD : 0.78;
      
      // For non-English queries, use a lower threshold
      if (language !== 'English') {
        minScoreSourcesThreshold = 0.45;
      }

      // Get relevant documents based on embeddings
      const embeddingsStore = await customRetriever.storeEmbeddings(
        language === 'English' ? ragResponse.answer : processedInput,
        minScoreSourcesThreshold,
        imageUrls
      );

      // Process and add documents to the result
      for (const [doc, score] of embeddingsStore) {
        // 🔒 SECURITY: Filter out private documents from public chatbot
        if (doc.metadata.isPublic === false) {
          console.log(`🔒 Skipping private document: ${doc.metadata.source}`);
          continue;
        }
        
        // Skip certain types for English queries
        if (language === 'English' && (doc.metadata.type === 'other' || doc.metadata.type === 'vbs')) {
          continue;
        }
        
        // Skip txt and user_input types for non-English queries
        if (language !== 'English' && (doc.metadata.type === 'txt' || doc.metadata.type === 'user_input')) {
          continue;
        }

        const myDoc = new MyDocument({
          pageContent: doc.pageContent,
          metadata: {
            source: doc.metadata.source,
            type: doc.metadata.type,
            videoLink: doc.metadata.videoLink,
            file: doc.metadata.file,
            score: score,
            image: doc.metadata.image,
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

      // Store the Q&A in the database
      const db = new TenantDB();
      await db.insertQA(
        originalInput, 
        ragResponse.answer, 
        ragResponse.context, 
        Documents, 
        qaId, 
        roomId, 
        userEmail, 
        imageUrls, 
        language, 
        'openai'
      );

      // Update chat memory
      await updateConversationMemory(
        roomId,
        originalInput,
        ragResponse.answer,
        imageUrls,
        userEmail,
        Documents,
        qaId,
        undefined,
        language
      );

      // Return the result instead of emitting via socket
      return {
        answer: ragResponse.answer,
        qaId: qaId,
        sourceDocs: Documents
      };
    },
    vectorstore,
  };
};