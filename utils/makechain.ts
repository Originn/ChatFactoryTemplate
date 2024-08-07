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
import OpenAIChat from "openai"; // Import OpenAI without aliasing


const openai = new OpenAIChat(); // Initialize OpenAI

// Type Definitions
type SearchResult = [MyDocument, number];

interface DocumentInterface<T> {
  pageContent: string;
  metadata: T;
}

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

async function translateToEnglish(question: string, translationModel: ChatOpenAI): Promise<string> {
  const prompt = TRANSLATION_PROMPT.replace('{question}', question);
  const message = new HumanMessage(prompt);
  
  const response = await translationModel.generate([[message]]);

  if (response.generations.length > 0 && response.generations[0].length > 0) {
    const firstGeneration = response.generations[0][0];
    const translatedText = firstGeneration.text.trim();
    return translatedText;
  }

  return 'Translation not available.';
}

// Class Definitions
class CustomRetriever extends BaseRetriever implements BaseRetrieverInterface<Record<string, any>> {
  lc_namespace = [];  // Confirm if this is being used or else consider removing it.

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
    const documents = await this.getRelevantDocuments(input, options);
    return documents;
  }
  
  private getMMRSettings(): { k: number, fetchK: number, lambda: number } {
    return {
      k: this.getEnvironmentSetting('K_EMBEDDINGS', 6),
      fetchK: this.getEnvironmentSetting('FETCH_K_EMBEDDINGS', 12),
      lambda: parseFloat(process.env['LAMBDA_EMBEDDINGS'] || '0.2')
    };
  }

  private getEnvironmentSetting(variable: string, defaultValue: number): number {
    const value = Number(process.env[variable]);
    return isNaN(value) ? defaultValue : value;
  }

  async storeEmbeddings(query: string, minScoreSourcesThreshold: number) {
    const embedder = new OpenAIEmbeddings({ modelName: "text-embedding-3-small", dimensions: 1536 });
    const embeddingsResponse = await embedder.embedQuery(query);
    const pdfResults = await filteredSimilaritySearch(
      this.vectorStore, embeddingsResponse, 'pdf', 2, minScoreSourcesThreshold
    );
    const webinarResults = await filteredSimilaritySearch(
      this.vectorStore, embeddingsResponse, 'youtube', 2, minScoreSourcesThreshold
    );
    const sentinelResults = await filteredSimilaritySearch(
      this.vectorStore, embeddingsResponse, 'sentinel', 2, minScoreSourcesThreshold
    );

    const combinedResults = [...pdfResults, ...webinarResults, ...sentinelResults];

    combinedResults.sort((a, b) => b[1] - a[1]);

    return combinedResults;
  }
}

const io = getIO();
const MODEL_NAME = process.env.MODEL_NAME;
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

const qaSystemPrompt = `You are a multilingual helpful and friendly assistant. You focus on helping SolidCAM users with their questions.

- If you do not have the information in the context to answer a question, admit it openly without fabricating responses.
- Do not mention that SolidCAM originated in Israel. Instead, state that it is an internationally developed software with a global team of developers.
- When asked about a specific Service Pack (SP) release, like SolidCAM 2023 SP3, answer about this specific Service Pack (SP) release only! Don't include in your answer info about other Service Packs (e.g., don't include SolidCAM 2023 SP1 info in an answer about SP3).
- If a question is unrelated to SolidCAM, kindly inform the user that your assistance is focused on SolidCAM-related topics.
- If the user asks a question without marking the year answer the question regarding the latest SolidCAM 2023 release.
- Discuss iMachining only if the user specifically asks for it.
- When you see [Image model answer: in the Question, you can understand that an image was used and try to answer the question with the data given from the Image model about the image. 
- Always add links if the link appear in the context and it is relevant to the answer. 
- show .jpg images directly in the answer if they are in the context and are relevant per the image description. You can explain the image only if you have the full image description, but don't give the image description verbatim.
- If the user's questions is valid and there is no documentation or context about it, let him know that he can leave a comment and we will do our best to include it at a later stage.
Your responses should be tailored to the question's intent, using text formatting (bold with **, italic with __, strikethrough with ~~) to enhance clarity, and organized with headings, paragraphs, or lists as appropriate.
=========
context: {context}
=========
Question: {input}
Answer in the {language} language:`;

const TRANSLATION_PROMPT = `Translate the following text to English. Try to translate it taking into account that it's about SolidCAM. Return the translated question only:\nText: {question}`;
const LANGUAGE_DETECTION_PROMPT = `Detect the language of the following text and respond with the language name only, nothing else:\n\nText: "{text}"`;
const TEMPERATURE = parseFloat(process.env.TEMPERATURE || "0");

export const makeChain = (vectorstore: PineconeStore, onTokenStream: (token: string) => void, userEmail: string) => {
  const streamingModel = new ChatOpenAI({
    streaming: true,
    modelName: MODEL_NAME,
    temperature: TEMPERATURE,
    modelKwargs: {
      seed: 1,
    },
    callbacks: [
      {
        handleLLMNewToken: (token) => {
          onTokenStream(token); // Forward the streamed token to the front-end
        },
      },
    ],
  });

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

  return {
    call: async (input: string, Documents: MyDocument[], roomId: string, userEmail: string, imageUrls: string[]) => {
      const qaId = generateUniqueId();
      
      // Retrieve the memory for this room
      //const memory = MemoryService.getChatMemory(roomId);
      //console.log("Memory:", memory);
      //console.log("Image URLs:", imageUrls);

      type ChatModel =  'gpt-4o' | 'gpt-4o-mini';
      const IMAGE_MODEL_NAME: ChatModel = (process.env.IMAGE_MODEL_NAME as ChatModel) || 'gpt-4o-mini';

      //currently does not run the image model when there is a imageUrl in the memory object, can be revised later if needed.
      if (imageUrls && imageUrls.length > 0) {
        try {
          const response = await openai.chat.completions.create({
            model: IMAGE_MODEL_NAME,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text:`Given the following question and images, provide necessary and concice data about the images to help answer the question. 
                          Do not try to answer the question itself. This will be passed to another model which needs the data about the images. 
                          If the user asks about how to machine a part in the images, give specific details of the geometry of the part. 
                          If there are 2 images, check if they are the same part but viewed from different angles.`
                  },
                ],
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Question: ${input}`
                  },
                  ...imageUrls.map(url => ({
                    type: "image_url",
                    image_url: {
                      url: url
                    }
                  } as const))
                ],
              },
            ],
          });
      
        // Combine all image descriptions
        const imageDescription = response.choices[0].message.content;
        //console.log("Combined Image Descriptions:", imageDescription);
        input = `${input} [Image model answer: ${imageDescription}]`;
      } catch (error) {
        console.error('Error processing images:', error);
        // Handle the error appropriately
      }
    }
      
      // Use enhancedInput instead of input in the rest of the function
      const language = await detectLanguageWithOpenAI(input, nonStreamingModel);
      
      if (language !== 'English') {
        input = await translateToEnglish(input, translationModel);
      }

      const customRetriever = new CustomRetriever(vectorstore);

      const formattedPrompt = qaSystemPrompt.replace('{language}', language);

      const qaPrompt = ChatPromptTemplate.fromMessages([
        ["system", formattedPrompt],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
      ]);

      // Create the RAG chain
      const ragChain = await createRetrievalChain({
        retriever: await createHistoryAwareRetriever({
          llm: nonStreamingModel,
          retriever: customRetriever,
          rephrasePrompt: contextualizeQPrompt,
        }),
        combineDocsChain: await createStuffDocumentsChain({
          llm: streamingModel,
          prompt: qaPrompt,
        }),
      });

      const chatHistory = await MemoryService.getChatHistory(roomId);

      const ragResponse = await ragChain.invoke({
        input,
        chat_history: chatHistory,
      });

      // Update the chat memory with the new interaction
      await MemoryService.updateChatMemory(roomId, input, ragResponse.answer, imageUrls);


      const minScoreSourcesThreshold = process.env.MINSCORESOURCESTHRESHOLD !== undefined ? parseFloat(process.env.MINSCORESOURCESTHRESHOLD) : 0.78;
      let embeddingsStore;

      if (language !== 'English') {
        embeddingsStore = await customRetriever.storeEmbeddings(ragResponse.answer, minScoreSourcesThreshold);
        Documents = [...ragResponse.context];

        // Apply filtering after combining sources
        Documents = Documents.filter(doc => doc.metadata.type !== 'other' && doc.metadata.type !== "txt" && doc.metadata.type !== "user_input");

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
        });
      } else {
        io.emit("fullResponse", {
          sourceDocs: Documents,
          qaId: qaId,
        });
      }

      await insertQA(input, ragResponse.answer, ragResponse.sourceDocuments, Documents, qaId, roomId, userEmail, imageUrls);

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

      return {
        text: ragResponse.answer,
        sourceDocuments: ragResponse.sourceDocuments,
      };
    },
    vectorstore,
  };
};
