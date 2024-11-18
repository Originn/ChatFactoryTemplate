// utils/makechain.ts

import { OpenAI as LangchainOpenAI, ChatOpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { MyDocument } from 'interfaces/Document';
import { BaseRetriever } from "@langchain/core/retrievers";
import { getIO } from "@/socketServer.cjs";
import { v4 as uuidv4 } from 'uuid';
import { insertQA } from '../db';
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
import OpenAIChat from "openai";
import { getChatHistoryByRoomId } from '../db';

const ENV = {
  MODEL_NAME: process.env.MODEL_NAME || 'gpt-4o',
  TEMPERATURE: parseFloat(process.env.TEMPERATURE || '0'),
  LAMBDA_EMBEDDINGS: parseFloat(process.env.LAMBDA_EMBEDDINGS || '0.1'),
  MINSCORESOURCESTHRESHOLD: parseFloat(process.env.MINSCORESOURCESTHRESHOLD || '0.78'),
  IMAGE_MODEL_NAME: process.env.IMAGE_MODEL_NAME || 'gpt-4o-mini',
};

const openai = new OpenAIChat();

// Type Definitions
type SearchResult = [MyDocument, number];

interface DocumentInterface<T> {
  pageContent: string;
  metadata: T;
}

// Constants
const io = getIO();
const MODEL_NAME = ENV.MODEL_NAME;
const TEMPERATURE = ENV.TEMPERATURE;

const contextualizeQSystemPrompt = `
Given the conversation history and a follow-up question, rephrase the follow-up question to be a standalone question focused on SolidCAM-specific content. 

- If the follow-up question includes a year (like "2023"), assume the user is asking about SolidCAM features or updates for that specific year. For example, if the follow-up question is "and in 2023?", rephrase it to "What are the steps for creating a pocket operation in SolidCAM 2023?".
- If the follow-up question does not need context (e.g., it's a remark like "thanks"), return the exact same text back.

Replace any abbreviations with their full names:
- HSS - High Speed Surface
- HSM - High Speed Machining
- HSR - High Speed Roughing
- gpp - general post processor
`;


const qaSystemPrompt = 
  "You are a multilingual, helpful, and friendly assistant that can receive images but not files, " +
  "and respond to questions and answers in every language. Answer in the {language} language. " +
  "You focus on helping SolidCAM users with their questions.\n\n" +
  
  "- If you do not have the information in the context to answer a question, admit it openly without fabricating responses.\n" +
  "- Do not mention that SolidCAM originated in Israel. Instead, state that it is an internationally developed software with a global team of developers.\n" +
  "- When asked about a specific Service Pack (SP) release, like SolidCAM 2023 SP3, answer about this specific Service Pack (SP) release only! " +
  "Don't include in your answer info about other Service Packs (e.g., don't include SP1 info in an answer about SP3).\n" +
  "- In the answers to questions, always include the year of the SolidCAM release referred to in the answer.\n" +
  "- If a question or image is unrelated to SolidCAM, kindly inform the user that your assistance is focused on SolidCAM-related topics.\n" +
  "- If the user asks a question without marking the year, answer the question regarding the latest SolidCAM 2024 release.\n" +
  "- If Image Description is included, it means an image was analyzed. Take the description into account when answering the question.\n" +
  "- Discuss iMachining only if the user specifically asks for it.\n" +
  "- Add links in the answer only if the link appears in the context and it is relevant to the answer.\n" +
  "- Don't make up links that do not exist in the context like https://example.com/chamfer_mill_tool.jpg.\n" +
  "- Always ask yourself if there is a relevant image to show from the context, and if there is, show it.\n" +
  "- When there is an image description don't answer like this 'the image you describe'... just answer the question using the description without mentioning it.\n" +
  "- If the user's question is valid and there is no documentation or context about it, let them know that they can leave a comment, " +
  "and we will do our best to include it at a later stage.\n" +
  "- If a user asks for a competitor's advantage over SolidCAM, reply in a humorous way that SolidCAM is the best CAM, " +
  "and don't give any additional information on how they are better.\n\n" +
  
  "=========\n" +
  "context: {context}\n" +
  "Image Description: {imageDescription}\n" +
  "=========\n" +
  "Answer in the {language} language:";

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

function initializeChatHistory(roomId: any, userEmail: string) {
  // Directly call updateChatMemory with "Hi" as the initial input
  console.log("Initializing chat history for room:", roomId);
  MemoryService.updateChatMemory(roomId, "Hi", null, null, userEmail);
}

export const makeChain = (vectorstore: PineconeStore, onTokenStream: (token: string) => void, userEmail: string) => {
  const nonStreamingModel = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: TEMPERATURE,
    verbose:true,
  });

  const translationModel = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: TEMPERATURE,
  });

  function generateUniqueId(): string {
    return uuidv4();
  }

  async function isNewChatSession(roomId: any): Promise<boolean> {
    const chatHistory = await MemoryService.getChatHistory(roomId);
    return chatHistory.length === 0;
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
  // const getImageUrls = async (imageUrls: string[] | undefined, roomId: string): Promise<string[]> => {
  //   if (imageUrls && imageUrls.length > 0) {
  //     return imageUrls;
  //   }
  // };

  const getImageUrlsinHistory = async (imageUrls: string[] | undefined, roomId: string): Promise<string[]> => {
    // If imageUrls are provided, return them immediately
    if (imageUrls && imageUrls.length > 0) {
      return imageUrls;
    }
  
    // Retrieve the full chat history for the given room
    const memory = await MemoryService.getChatHistory(roomId);
    console.log('memory from getImageUrls:', memory);
  
    // Extract image URLs from the entire chat history
    const extractedImageUrls: string[] = [];
    for (const message of memory) {
      if (message?.additional_kwargs?.imageUrls) {
        const urls = Array.isArray(message.additional_kwargs.imageUrls)
          ? message.additional_kwargs.imageUrls
          : [message.additional_kwargs.imageUrls];
        extractedImageUrls.push(...urls);
      }
    }
  
    // Return all unique image URLs
    return Array.from(new Set(extractedImageUrls));
  };

  return {
    call: async (input: string, Documents: MyDocument[], roomId: string, userEmail: string, imageUrls: string[]) => {
      if (await isNewChatSession(roomId)) {
        initializeChatHistory(roomId, userEmail);
      }

      const qaId = generateUniqueId();

      const streamingModel = new ChatOpenAI({
        streaming: true,
        modelName: MODEL_NAME,
        //verbose: true,
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

      console.log('Image URLs ya fucker:', imageUrls);

      //const processedImageUrls = await getImageUrls(imageUrls, roomId);
      
      // Handle image processing
      let imageDescription = '';
      if (imageUrls && imageUrls.length > 0) {
        try {
          console.log('Processing images...');
          type ChatModel = 'gpt-4o' | 'gpt-4o-mini';
          const IMAGE_MODEL_NAME: ChatModel = (ENV.IMAGE_MODEL_NAME as ChatModel) || 'gpt-4o-mini';
          
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
                  ...imageUrls.map(url => ({
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

      async function isQuestionRelatedToImage(
        followUpQuestion: string,
        chatHistory: (HumanMessage | AIMessage)[],
        model: ChatOpenAI,
        imageDescription: string,
      ): Promise<boolean> {
        const formattedHistory = chatHistory
          .map((message) => {
            const speaker = message instanceof HumanMessage ? 'User' : 'AI';
            const content = message.content || 'No message content';
            return `${speaker}: ${content}`;
          })
          .join('\n');
      
        const descriptionPart = imageDescription
          ? `Relevant Image Description:\n${imageDescription}\n`
          : '';
      
        const prompt = `
      You are analyzing a conversation to determine whether a follow-up question is related to an image previously discussed in the conversation.
      
      Here is the chat history:
      ${formattedHistory}
      
      ${descriptionPart}
      
      Here is the follow-up question:
      "${followUpQuestion}"
      
      Determine if the follow-up question may be related to the image previously described in the conversation and if there is a need to have another look at the image to answer the question or you can use previous AI answers to answer the question. Answer "Yes" if you must see the image again and "No" if you don't. Provide no additional commentary.`;
      
        const response = await model.generate([[new HumanMessage(prompt)]]);
      
        const answer = response.generations[0][0]?.text.trim().toLowerCase();
        return answer === 'yes';
      }
      
      // Get chat history and format it
      const rawChatHistory = await MemoryService.getChatHistory(roomId);
      console.log('Raw chat history:', rawChatHistory);

      let hasImage = await getImageUrlsinHistory(imageUrls, roomId);
      

      // Only check history for images if current question has no images
      if (imageUrls.length === 0 && hasImage.length > 0) {
        

        console.log('Processed image URLs from history:', hasImage);

        const relatedToImage = await isQuestionRelatedToImage(input, rawChatHistory, nonStreamingModel, imageDescription);
      
        if (relatedToImage) {
          console.log('Question is related to image from history');
      
          try {
            type ChatModel = 'gpt-4o' | 'gpt-4o-mini';
            const IMAGE_MODEL_NAME: ChatModel = (ENV.IMAGE_MODEL_NAME as ChatModel) || 'gpt-4o-mini';
      
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
                    ...hasImage.map(url => ({
                      type: "image_url",
                      image_url: { url }
                    } as const))
                  ],
                },
              ],
            });
      
            imageDescription = response.choices[0]?.message?.content ?? 'No image description available';
          } catch (error) {
            console.error('Error processing images from history:', error);
            imageDescription = 'Error processing image';
          }
      
          // Add the image model answer to the input
          if (imageDescription) {
            input = `${input} [Image model answer: ${imageDescription}]`;
          }
        } else {
          console.log('Question is not related to image from history');
        }

      } else {
        console.log('Current question has images, skipping history image processing');
      }

      const customRetriever = new CustomRetriever(vectorstore);



      const historyAwareRetriever = await createHistoryAwareRetriever({
        llm: nonStreamingModel,
        retriever: customRetriever,
        rephrasePrompt: contextualizeQPrompt,
      });


      const questionAnswerChain = await createStuffDocumentsChain({
        llm: streamingModel,
        prompt: qaPrompt,
      });

      const ragChain = await createRetrievalChain({
        retriever: historyAwareRetriever,
        combineDocsChain: questionAnswerChain,
      });

      console.log('Input:', input);

      const ragResponse = await ragChain.invoke({
        input,
        chat_history: rawChatHistory,
        language,
        imageDescription,
      });


      let minScoreSourcesThreshold = ENV.MINSCORESOURCESTHRESHOLD !== undefined ? 
        ENV.MINSCORESOURCESTHRESHOLD : 0.78;
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

      await insertQA(originalInput, ragResponse.answer, ragResponse.context, Documents, qaId, roomId, userEmail, imageUrls);

      try {
        let existingHistory;
        try {
          existingHistory = await getChatHistoryByRoomId(roomId);
        } catch (error) {
          console.error('Error fetching chat history:', error);
        }
      
        let conversationTitle = '';
        console.log(`existingHistory: ${JSON.stringify(existingHistory)}`);
        
        // Check if history exists and contains more than just the initial "Hi" message
        const shouldGenerateNewTitle = !existingHistory || 
          (existingHistory.conversation_json.length === 1 && 
           existingHistory.conversation_json[0].type === 'userMessage' && 
           existingHistory.conversation_json[0].message === 'Hi');
      
        if (shouldGenerateNewTitle) {
          console.log('Generating new conversation title');
          const titleResponse = await nonStreamingModel.generate([[new HumanMessage(
            `Given this conversation:
            Human: ${originalInput}
            AI: ${ragResponse.answer}
      
            Generate a short, descriptive title for this conversation (max 50 characters) in the used language.`
          )]]);
          conversationTitle = titleResponse.generations[0][0].text.trim();
          console.log(`Generated conversation title: ${conversationTitle}`);
        } else {
          conversationTitle = existingHistory.conversation_title;
        }
      
        // Updated call to updateChatMemory including the conversation title
        await MemoryService.updateChatMemory(
          roomId,
          originalInput,
          ragResponse.answer,
          imageUrls,
          userEmail,
          Documents,
          qaId,
          conversationTitle
        );
      
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
