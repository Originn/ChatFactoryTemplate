// utils/makechain.ts

import { OpenAI as LangchainOpenAI, ChatOpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { MyDocument } from 'utils/GCSLoader';
import { BaseRetriever } from "@langchain/core/retrievers";
import { getIO } from "@/socketServer.cjs";
import { v4 as uuidv4 } from 'uuid';
import { insertQA } from '../db';
import { OpenAIEmbeddings } from '@langchain/openai';
import { HumanMessage } from "@langchain/core/messages";
import { MaxMarginalRelevanceSearchOptions } from "@langchain/core/vectorstores";
import { BaseRetrieverInterface } from '@langchain/core/retrievers';
import { RunnableConfig } from '@langchain/core/runnables';
import MemoryService from '@/utils/memoryService';
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { createRetrievalChain } from "langchain/chains/retrieval";
import OpenAIChat from "openai";
import { insertChatHistory, getChatHistoryByRoomId } from '../db';

const openai = new OpenAIChat();

// Type Definitions
type SearchResult = [MyDocument, number];

interface DocumentInterface<T> {
  pageContent: string;
  metadata: T;
}

// Constants
const io = getIO();
const MODEL_NAME = process.env.MODEL_NAME;
const TEMPERATURE = parseFloat(process.env.TEMPERATURE || "0");

const contextualizeQSystemPrompt = `Given the history of the conversation and a follow up question, rephrase the follow up question to be a standalone question.
If the follow up question does not need context like when the follow up question is a remark like: excellent, thanks, thank you etc., return the exact same text back.
Rephrase the Standalone question also if replacing abbreviations to full strings.
abbreviations:
HSS - High Speed Surface
HSM - High Speed Machining
HSR - High Speed Roughing
gpp - general post processor

Chat History:
{chat_history}
Follow Up Input: {input}
Standalone question:`;

const qaSystemPrompt = `You are a multilingual helpful and friendly assistant that can receive images but not files, and questions in every language. Answer in the {language} language. You focus on helping SolidCAM users with their questions.

- If you do not have the information in the context to answer a question, admit it openly without fabricating responses.
- Do not mention that SolidCAM originated in Israel. Instead, state that it is an internationally developed software with a global team of developers.
- When asked about a specific Service Pack (SP) release, like SolidCAM 2023 SP3, answer about this specific Service Pack (SP) release only! Don't include in your answer info about other Service Packs (e.g., don't include SP1 info in an answer about SP3).
- If a question or image is unrelated to SolidCAM, kindly inform the user that your assistance is focused on SolidCAM-related topics.
- If the user asks a question without marking the year, answer the question regarding the latest SolidCAM 2024 release.
- If Image Description is included, it means an image was analyzed. Taking the description into account when answering the question.
- Discuss iMachining only if the user specifically asks for it.
- Add links in the answer only if the link appears in the context and it is relevant to the answer.
- Don't make up links that do not exist in the context like https://example.com/chamfer_mill_tool.jpg etc.
- Always ask yourself if there is a relevant image to show from the context, and if there is show it.
- If the user's question is valid and there is no documentation or context about it, let them know that they can leave a comment and we will do our best to include it at a later stage.
- If a user asks for a competitor's advantage over SolidCAM, reply in a humorous way that SolidCAM is the best CAM, and don't give any additional information on how they are better.

=========
context: {context}
Image Description: {imageDescription}
=========
Question: {input}
Answer in the {language} language:`;

const TRANSLATION_PROMPT = `Translate the following text to English. Try to translate it taking into account that it's about SolidCAM. Return the translated text only:
Text: {text}`;

const LANGUAGE_DETECTION_PROMPT = `Detect the language of the following text and respond with the language name only, nothing else. If the language cannot be detected, respond with "English".:
Text: "{text}"`;

// Utility Functions
async function detectLanguageWithOpenAI(text: string, nonStreamingModel: ChatOpenAI): Promise<string> {
  const prompt = LANGUAGE_DETECTION_PROMPT.replace('{text}', text);
  const message = new HumanMessage(prompt);
  const response = await nonStreamingModel.generate([[message]]);

  if (response.generations.length > 0 && response.generations[0].length > 0) {
    const firstGeneration = response.generations[0][0];
    return firstGeneration.text.trim();
  }

  return 'English';
}

async function filteredSimilaritySearch(vectorStore: any, queryVector: number[], type: string, limit: number, minScore: number): Promise<SearchResult[]> {
  try {
    const results: SearchResult[] = await vectorStore.similaritySearchVectorWithScore(queryVector, limit, { type: type });
    const filteredResults = results.filter(([document, score]: SearchResult) => score >= minScore);
    return filteredResults;
  } catch (error) {
    console.error("Error in filteredSimilaritySearch:", error);
    return [];
  }
}

async function translateToEnglish(text: string, translationModel: ChatOpenAI): Promise<string> {
  const prompt = TRANSLATION_PROMPT.replace('{text}', text);
  const message = new HumanMessage(prompt);

  const response = await translationModel.generate([[message]]);

  if (response.generations.length > 0 && response.generations[0].length > 0) {
    const firstGeneration = response.generations[0][0];
    return firstGeneration.text.trim();
  }

  return 'Translation not available.';
}

// Custom Retriever Class
class CustomRetriever extends BaseRetriever implements BaseRetrieverInterface<Record<string, any>> {
  lc_namespace = [];

  constructor(private vectorStore: PineconeStore) {
    super();
  }

  async getRelevantDocuments(query: string, options?: Partial<RunnableConfig>): Promise<DocumentInterface<Record<string, any>>[]> {
    const { k, fetchK, lambda } = this.getMMRSettings();

    const mmrOptions: MaxMarginalRelevanceSearchOptions<any> = {
      k: k,
      fetchK: fetchK,
      lambda: lambda,
    };

    const results = await this.vectorStore.maxMarginalRelevanceSearch(query, mmrOptions);
    return results.map(doc => new MyDocument({
      ...doc,
      metadata: { ...doc.metadata }
    }));
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

  async storeEmbeddings(query: string, minScoreSourcesThreshold: number) {
    const embedder = new OpenAIEmbeddings({ modelName: "text-embedding-3-small", dimensions: 1536 });
    const embeddingsResponse = await embedder.embedQuery(query);
    
    const [pdfResults, webinarResults, sentinelResults] = await Promise.all([
      filteredSimilaritySearch(this.vectorStore, embeddingsResponse, 'pdf', 2, minScoreSourcesThreshold),
      filteredSimilaritySearch(this.vectorStore, embeddingsResponse, 'youtube', 2, minScoreSourcesThreshold),
      filteredSimilaritySearch(this.vectorStore, embeddingsResponse, 'sentinel', 2, minScoreSourcesThreshold)
    ]);

    const combinedResults = [...pdfResults, ...webinarResults, ...sentinelResults];
    return combinedResults.sort((a, b) => b[1] - a[1]);
  }
}

export const makeChain = (vectorstore: PineconeStore, onTokenStream: (token: string) => void, userEmail: string) => {
  const nonStreamingModel = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: TEMPERATURE,
  });

  const translationModel = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: TEMPERATURE,
  });

  function generateUniqueId(): string {
    return uuidv4();
  }

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

  // Retrieve and process image URLs
  const getImageUrls = (imageUrls: string[] | undefined, roomId: string): string[] => {
    if (imageUrls && imageUrls.length > 0) {
      return imageUrls;
    }

    const memory = MemoryService.getChatMemory(roomId);
    if (memory.metadata.imageUrl) {
      return Array.isArray(memory.metadata.imageUrl) 
        ? memory.metadata.imageUrl 
        : [memory.metadata.imageUrl];
    }

    return [];
  };

  return {
    call: async (input: string, Documents: MyDocument[], roomId: string, userEmail: string, imageUrls: string[]) => {
      const qaId = generateUniqueId();

      const streamingModel = new ChatOpenAI({
        streaming: true,
        modelName: MODEL_NAME,
        verbose: true,
        temperature: TEMPERATURE,
        modelKwargs: { seed: 1 },
        callbacks: [{
          handleLLMNewToken: (token) => {
            if (roomId) {
              io.to(roomId).emit(`tokenStream-${roomId}`, token);
            } else {
              console.error('No roomId available for token stream');
            }
          },
        }],
      });

      const processedImageUrls = getImageUrls(imageUrls, roomId);
      
      // Handle image processing
      let imageDescription = '';
      if (processedImageUrls.length > 0) {
        try {
          type ChatModel = 'gpt-4o' | 'gpt-4o-mini';
          const IMAGE_MODEL_NAME: ChatModel = (process.env.IMAGE_MODEL_NAME as ChatModel) || 'gpt-4o-mini';
          
          const response = await openai.chat.completions.create({
            model: IMAGE_MODEL_NAME,
            messages: [
              {
                role: "user",
                content: [
                  { 
                    type: "text", 
                    text: `Given the following question and images, provide necessary and concise data about the images to help answer the question.
                    Do not try to answer the question itself. This will be passed to another model which needs the data about the images. 
                    If the user asks about how to machine a part in the images, give specific details of the geometry of the part. 
                    If there are 2 images, check if they are the same part but viewed from different angles.`
                  },
                ],
              },
              {
                role: "user",
                content: [
                  { type: "text", text: `Question: ${input}` },
                  ...processedImageUrls.map(url => ({
                    type: "image_url",
                    image_url: { url }
                  } as const))
                ],
              },
            ],
          });
      
          imageDescription = response.choices[0]?.message?.content ?? 'No image description available';
        } catch (error) {
          console.error('Error processing images:', error);
          imageDescription = imageDescription = 'Error processing image';
        }
      }

      // Handle language detection and translation
      const language = await detectLanguageWithOpenAI(input, nonStreamingModel);
      const originalInput = input;

      if (language !== 'English') {
        input = await translateToEnglish(input, translationModel);
      }

      if (imageDescription) {
        input = `${input} [Image model answer: ${imageDescription}]`;
      }

      // Get chat history and format it
      const rawChatHistory = await MemoryService.getChatHistory(roomId);

      const customRetriever = new CustomRetriever(vectorstore);

      const historyAwareRetriever = await createHistoryAwareRetriever({
        llm: nonStreamingModel,
        retriever: customRetriever,
        rephrasePrompt: contextualizeQPrompt,
      });

      const ragChain = await createRetrievalChain({
        retriever: historyAwareRetriever,
        combineDocsChain: await createStuffDocumentsChain({
          llm: streamingModel,
          prompt: qaPrompt,
        }),
      });

      const ragResponse = await ragChain.invoke({
        input,
        chat_history: rawChatHistory,
        language,
        imageDescription,
      });

      // Update chat memory
      await MemoryService.updateChatMemory(roomId, originalInput, ragResponse.answer, processedImageUrls);

      let minScoreSourcesThreshold = process.env.MINSCORESOURCESTHRESHOLD !== undefined ? 
        parseFloat(process.env.MINSCORESOURCESTHRESHOLD) : 0.78;
      let embeddingsStore;

      if (language !== 'English') {
        minScoreSourcesThreshold = 0.45;
        embeddingsStore = await customRetriever.storeEmbeddings(input, minScoreSourcesThreshold);

        for (const [doc, score] of embeddingsStore) {
          if (doc.metadata.type !== "txt" && doc.metadata.type !== "user_input") {
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
        }
        Documents.sort((a, b) => (b.metadata.score ? 1 : 0) - (a.metadata.score ? 1 : 0));
      }

      if (language === 'English') {
        embeddingsStore = await customRetriever.storeEmbeddings(ragResponse.answer, minScoreSourcesThreshold);
        for (const [doc, score] of embeddingsStore) {
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

        // Apply filtering after combining sources
        Documents = Documents.filter(doc => doc.metadata.type !== 'other');
      }

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

      await insertQA(originalInput, ragResponse.answer, ragResponse.context, Documents, qaId, roomId, userEmail, processedImageUrls);

      try {
        let existingHistory;
        try {
          existingHistory = await getChatHistoryByRoomId(roomId);
        } catch (error) {
          console.error('Error fetching chat history:', error);
        }
      
        let conversationTitle = '';
        if (!existingHistory) {
          const titleResponse = await nonStreamingModel.generate([[new HumanMessage(
            `Given this conversation:
            Human: ${originalInput}
            AI: ${ragResponse.answer}
    
            Generate a short, descriptive title for this conversation (max 50 characters) in the used language.`
          )]]);
          conversationTitle = titleResponse.generations[0][0].text.trim();
        } else {
          conversationTitle = existingHistory.conversation_title;
        }
      
        const newHumanMessage = {
          type: 'userMessage',
          message: originalInput,
          isComplete: true,
          imageUrls: processedImageUrls
        };
        
        const newAIMessage = {
          type: 'apiMessage',
          message: ragResponse.answer,
          isComplete: true,
          sourceDocs: Documents,
          qaId: qaId
        };
      
        let messages;
        if (existingHistory) {
          let existingMessages;
          try {
            existingMessages = typeof existingHistory.conversation_json === 'string' 
              ? JSON.parse(existingHistory.conversation_json) 
              : existingHistory.conversation_json;
          } catch (parseError) {
            console.error('Error parsing existing conversation_json:', parseError);
            existingMessages = [];
          }
          messages = Array.isArray(existingMessages) ? [...existingMessages, newHumanMessage, newAIMessage] : [newHumanMessage, newAIMessage];
        } else {
          messages = [newHumanMessage, newAIMessage];
        }
  
        await insertChatHistory(userEmail, conversationTitle, roomId, messages);
      } catch (error) {
        console.error('Error in chat history:', error);
      }

      let totalScore = 0;
      let count = 0;
      if (Documents && Documents.length > 0) {
        for (let doc of Documents) {
          if (doc.metadata) {
            totalScore += doc.metadata.score || 0;
            count++;
          }
        }
        totalScore = count > 0 ? totalScore / count : 0;
      }

      return {};
    },
    vectorstore,
  };
};
