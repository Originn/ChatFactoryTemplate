// utils/makechain.ts

import { OpenAI as LangchainOpenAI, ChatOpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { MyDocument } from 'interfaces/Document';
import { BaseRetriever } from "@langchain/core/retrievers";
import { getIO } from "@/socketServer.cjs";
import { v4 as uuidv4 } from 'uuid';
import { insertQA, getChatHistoryByRoomId } from '../db';
import { OpenAIEmbeddings } from '@langchain/openai';
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
import { deepseekQASystemPrompt } from './prompts/deepseekPrompt';
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
  MODEL_NAME: process.env.MODEL_NAME || 'gpt-4.1',
  TEMPERATURE: parseFloat(process.env.TEMPERATURE || '0'),
  LAMBDA_EMBEDDINGS: parseFloat(process.env.LAMBDA_EMBEDDINGS || '0.1'),
  MINSCORESOURCESTHRESHOLD: parseFloat(process.env.MINSCORESOURCESTHRESHOLD || '0.78'),
  IMAGE_MODEL_NAME: process.env.IMAGE_MODEL_NAME || 'gpt-4.1-mini',
};

// Initialize shared resources
const io = getIO();

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

function preprocessChatHistoryForDeepSeek(history: (HumanMessage | AIMessage)[]) {
  if (history.length <= 1) return history;
  
  const processedHistory: (HumanMessage | AIMessage)[] = [];
  
  for (let i = 0; i < history.length; i++) {
    const currentMessage = history[i];
    const lastProcessedMessage = processedHistory[processedHistory.length - 1];
    
    if (!lastProcessedMessage || 
        (currentMessage instanceof HumanMessage && lastProcessedMessage instanceof AIMessage) ||
        (currentMessage instanceof AIMessage && lastProcessedMessage instanceof HumanMessage)) {
      processedHistory.push(currentMessage);
    } else {
      processedHistory[processedHistory.length - 1] = currentMessage;
    }
  }
  
  return processedHistory;
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
      // Templates for common languages
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
      
      // Return the template for the detected language, or English if not found
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
      // Get existing history to check if we need a new title
      let existingHistory;
      try {
        existingHistory = await getChatHistoryByRoomId(roomId);
      } catch (error) {
        console.error('Error fetching chat history:', error);
      }
      
      // Check if history exists and contains more than just the initial "Hi" message
      const shouldGenerateNewTitle = !existingHistory || 
        (existingHistory.conversation_json.length === 1 && 
         existingHistory.conversation_json[0].type === 'userMessage' && 
         existingHistory.conversation_json[0].message === 'Hi');
      
      if (shouldGenerateNewTitle) {
        // Create a shared model instance for title generation - could be optimized further
        const titleModel = new ChatOpenAI({
          modelName: 'gpt-4.1-nano',
          temperature: ENV.TEMPERATURE,
        });
        conversationTitle = await generateConversationTitle(originalInput, answer, titleModel, language);
      } else {
        conversationTitle = existingHistory.conversation_title;
      }
    }
    
    // Update memory with conversation
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

// Custom Retriever Class with enhanced efficiency
class CustomRetriever extends BaseRetriever implements BaseRetrieverInterface<Record<string, any>> {
  lc_namespace = [];
  private embedder: OpenAIEmbeddings;
  
  constructor(
    private vectorStore: PineconeStore,
    embeddingsModelName: string = "text-embedding-3-small"
  ) {
    super();
    // Initialize embedder once for reuse
    this.embedder = new OpenAIEmbeddings({ 
      modelName: embeddingsModelName, 
      dimensions: 1536 
    });
  }

  async getRelevantDocuments(query: string, options?: Partial<RunnableConfig>): Promise<DocumentInterface<Record<string, any>>[]> {
    // Check if this is an API-related query
    const isApiQuery = isApiRelatedQuery(query);
    
    // Get standard MMR results first
    const { k, fetchK, lambda } = this.getMMRSettings();
    const mmrOptions: MaxMarginalRelevanceSearchOptions<any> = {
      k: k,
      fetchK: fetchK,
      lambda: lambda,
    };
    
    // For API queries, modify the MMR options to get more results
    if (isApiQuery) {
      mmrOptions.fetchK = Math.max(mmrOptions.fetchK ?? 0, 20);
    }
    
    try {
      const mmrResults = await this.vectorStore.maxMarginalRelevanceSearch(query, mmrOptions);
      
      // For API queries, also get VBS files with lower threshold
      if (isApiQuery) {
        try {
          const queryEmbedding = await this.embedder.embedQuery(query);
          
          // Get VBS files with lower threshold (0.3)
          const vbsFilter = { type: 'vbs' };
          const vbsResults = await this.vectorStore.similaritySearchVectorWithScore(queryEmbedding, 5, vbsFilter);
          
          // If we found any VBS files
          if (vbsResults && vbsResults.length > 0) {
            
            // Create MyDocument objects for VBS files
            const vbsDocs = vbsResults
              .filter(([_, score]) => score >= 0.3) // Only keep those above threshold
              .map(([doc, _]) => new MyDocument({
                pageContent: typeof doc === 'object' && doc !== null ? doc.pageContent : '',
                metadata: typeof doc === 'object' && doc !== null ? { ...doc.metadata } : {}
              }));
            
            // Return VBS docs first, then MMR results to prioritize them
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

  async invoke(input: string, options?: Partial<RunnableConfig>): Promise<DocumentInterface<Record<string, any>>[]> {
    return await this.getRelevantDocuments(input, options);
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
      const results: SearchResult[] = await this.vectorStore.similaritySearchVectorWithScore(
        queryVector, 
        limit, 
        { type: type }
      );
      return results.filter(([_, score]: SearchResult) => score >= minScore);
    } catch (error) {
      console.error(`Error in filteredSimilaritySearch for type ${type}:`, error);
      return [];
    }
  }

  async storeEmbeddings(query: string, minScoreSourcesThreshold: number) {
    try {
      const queryEmbedding = await this.embedder.embedQuery(query);
      
      // If query is API-related, include VBS files in the search
      const isApiQuery = isApiRelatedQuery(query);
      
      // Use Promise.all to run searches in parallel
      const [pdfResults, webinarResults, sentinelResults, vimeoResults, vbsResults] = await Promise.all([
        this.filteredSimilaritySearch(queryEmbedding, 'pdf', 2, minScoreSourcesThreshold),
        this.filteredSimilaritySearch(queryEmbedding, 'youtube', 2, minScoreSourcesThreshold),
        this.filteredSimilaritySearch(queryEmbedding, 'sentinel', 2, minScoreSourcesThreshold),
        this.filteredSimilaritySearch(queryEmbedding, 'vimeo', 2, minScoreSourcesThreshold),
        // Only fetch VBS files for API-related queries
        isApiQuery ? this.filteredSimilaritySearch(queryEmbedding, 'vbs', 5, 0.3) : Promise.resolve([])
      ]);
    
      const combinedResults = [...pdfResults, ...webinarResults, ...sentinelResults, ...vimeoResults];
      
      // If it's an API query, boost VBS scores and add them to results
      if (isApiQuery && vbsResults.length > 0) {
        const boostedVbsResults = vbsResults.map(([doc, score]) => {
          const boostedScore = Math.min(score * 1.4, 0.98); // Boost by 40%, cap at 0.98
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

// Main function to make the chain
export const makeChain = (
  vectorstore: PineconeStore, 
  onTokenStream: (token: string) => void, 
  userEmail: string, 
  aiProvider: string = 'openai'
) => {
  // Create shared model instances
  const sharedModel = new ChatOpenAI({
    modelName: 'gpt-4.1-mini',
    temperature: ENV.TEMPERATURE,
    verbose: false,
  });

  const translationModel = new ChatOpenAI({
    modelName: 'gpt-4.1-mini',
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

  // Initialize custom retriever with the vectorstore
  const customRetriever = new CustomRetriever(vectorstore);

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

      // Initialize streaming model based on AI provider preference
      const streamingModel = createChatModel(aiProvider, {
        streaming: true,
        verbose: false,
        maxTokens: 4000,
        callbacks: [{
          handleLLMNewToken: (token: any) => {
            if (roomId) {
              io.to(roomId).emit(`tokenStream-${roomId}`, token);
            } else {
              console.error('No roomId available for token stream');
            }
          },
        }],
      });

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

      // Process chat history based on AI provider
      let processedChatHistory = rawChatHistory;
      if (aiProvider === 'deepseek') {
        processedChatHistory = preprocessChatHistoryForDeepSeek(rawChatHistory);
      }

      // Log if this is an API-related query
      const isApiQuery = isApiRelatedQuery(processedInput);

      // Create history-aware retriever
      const historyAwareRetriever = await createHistoryAwareRetriever({
        llm: sharedModel as any,
        retriever: customRetriever as any,
        rephrasePrompt: contextualizeQPrompt as any,
      });
      
      // Create QA chain with the appropriate prompt based on AI provider
      const selectedPrompt = aiProvider === 'deepseek' 
        ? ChatPromptTemplate.fromMessages([
            ["system", deepseekQASystemPrompt],
            new MessagesPlaceholder("chat_history"),
            ["human", "{input}"],
          ])
        : qaPrompt;
      
      const questionAnswerChain = await createStuffDocumentsChain({
        llm: streamingModel as any,
        prompt: selectedPrompt as any,
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
      const ragResponse = await ragChain.invoke({
        input: processedInput,
        chat_history: relevantHistory as any,
        language,
        imageDescription,
      });

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
        minScoreSourcesThreshold
      );

      // Process and add documents to the result
      for (const [doc, score] of embeddingsStore) {
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

      // Send the full response to the client
      if (roomId) {
        io.to(roomId).emit(`fullResponse-${roomId}`, {
          roomId: roomId,
          sourceDocs: Documents,
          qaId: qaId,
          answer: ragResponse.answer,
        });
      } else {
        io.emit("fullResponse", {
          sourceDocs: Documents,
          qaId: qaId,
          answer: ragResponse.answer,
        });
      }

      // Store the Q&A in the database
      await insertQA(
        originalInput, 
        ragResponse.answer, 
        ragResponse.context, 
        Documents, 
        qaId, 
        roomId, 
        userEmail, 
        imageUrls, 
        language, 
        aiProvider
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

      return {};
    },
    vectorstore,
  };
};