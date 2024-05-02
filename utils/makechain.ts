//makechain.ts

import { OpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { MyDocument } from 'utils/GCSLoader';
import { BufferMemory } from "langchain/memory";
import { BaseRetriever } from "@langchain/core/retrievers";
import { getIO } from "@/socketServer.cjs";
import { v4 as uuidv4 } from 'uuid';
import { insertQA } from '../db';
import { OpenAIEmbeddings } from '@langchain/openai';
import { HumanMessage } from "@langchain/core/messages";
import { MaxMarginalRelevanceSearchOptions } from "@langchain/core/vectorstores";
// Type Definitions
type SearchResult = [MyDocument, number];

// Utility Functions
async function detectLanguageWithOpenAI(text: string, nonStreamingModel: OpenAI): Promise<string> {
  const prompt = LANGUAGE_DETECTION_PROMPT.replace('{text}', text);
  const response = await nonStreamingModel.generate([prompt]);

  if (response.generations.length > 0 && response.generations[0].length > 0) {
    const firstGeneration = response.generations[0][0];
    return firstGeneration.text.trim();
  }

  return 'English';
}

async function filteredSimilaritySearch(vectorStore: any, queryVector: number[], type: string, limit: number, minScore: number): Promise<SearchResult[]> {
  try {
    
    const results: SearchResult[] = await vectorStore.similaritySearchVectorWithScore(queryVector, limit, { type: type });

    // Explicitly type the destructured elements in the filter method
    const filteredResults = results.filter(([document, score]: SearchResult) => score >= minScore);

    return filteredResults;
  } catch (error) {
    console.error("Error in filteredSimilaritySearch:", error);
    return [];
  }
}

async function translateToEnglish(question: string, translationModel: OpenAI): Promise<string> {
  const response = await translationModel.generate([TRANSLATION_PROMPT.replace('{question}', question)]);

  // Extract the translated text from the response
  if (response.generations.length > 0 && response.generations[0].length > 0) {
    const firstGeneration = response.generations[0][0];
    const translatedText = firstGeneration.text.trim();
    return translatedText;
  }

  // Return an empty string or a default message if no translation is found
  return 'Translation not available.';
}

// Class Definitions
class CustomRetriever extends BaseRetriever {
  
  lc_namespace = [];

  constructor(private vectorStore: PineconeStore) {
    super();
  }

  async getRelevantDocuments(query: string): Promise<MyDocument<Record<string, any>>[]> {
    // Set up MMR search options
    const mmrOptions: MaxMarginalRelevanceSearchOptions<any> = {
        k: 6,
        fetchK: 12,  // Option to fetch more documents initially if supported
        lambda: 0.5, // Adjust lambda to balance relevance and diversity
    };

    // Use MMR to fetch documents
    const results = await this.vectorStore.maxMarginalRelevanceSearch(query, mmrOptions);
    // Map each result to include the document and its score inside metadata
    return results.map(doc => {
      const newMetadata = {
        ...doc.metadata 
      };

      return new MyDocument({
        ...doc,
        metadata: newMetadata
      });
    });
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

    const combinedResults = [...pdfResults, ...webinarResults,...sentinelResults];

    combinedResults.sort((a, b) => b[1] - a[1]);

    return combinedResults;
  }
  // Implement any other abstract methods or properties required by BaseRetriever
}

// Constants and Variables
const io = getIO();
const roomMemories: Record<string, BufferMemory> = {};
const MODEL_NAME = process.env.MODEL_NAME;
const CONDENSE_PROMPT = `Given the history of the conversation and a follow up question, rephrase the follow up question to be a standalone question.
If the follow up question does not need context like when the follow up question is a remark like: excellent, thanks, thank you etc., return the exact same text back.
Rephrase the Standalone question also if replacing abbriviations to full strings.
abbriviations:
HSS - High Speed Surface
HSM - High Speed Machining
HSR - High Speed Roughing
gpp - general post processor

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;

// QA_PROMPT is reliable for specific request from us, and also incoporating the new question generated by the CONDENSE_PROMPT
const QA_PROMPT = `You are a multilingual helpful and friendly assistant. You focus on helping SolidCAM users with their questions.

- If a question is unrelated to SolidCAM, kindly inform the user that your assistance is focused on SolidCAM-related topics.
- If the user asks a question without marking the year answer the question regarding the latest SolidCAM 2023 release.
- Discuss iMachining only if the user specifically asks for it.
- If you do not have the information in the context to answer a question, admit it openly without fabricating responses.
Your responses should be tailored to the question's intent, using text formatting (bold with **, italic with __, strikethrough with ~~) to enhance clarity, and organized with headings, paragraphs, or lists as appropriate.
=========
context: {context}
=========
Question: {question}
Answer in the {language} language:`;


const TRANSLATION_PROMPT = `Translate the following text to English. Try to translate it taking into account that it's about SolidCAM. Return the translated question only:\nText: {question}`;
const LANGUAGE_DETECTION_PROMPT = `Detect the language of the following text and respond with the language name only, nothing else:\n\nText: "{text}"`;
const TEMPRATURE = parseFloat(process.env.TEMPRATURE || "0");

export const makeChain = (vectorstore: PineconeStore, onTokenStream: (token: string) => void, userEmail: string) => {
  
  const streamingModel = new OpenAI({
    streaming: true,
    modelName: MODEL_NAME,
    temperature: TEMPRATURE,
    modelKwargs: {
      seed: 1
    },
    callbacks: [
      {
        handleLLMNewToken: (token) => {
          onTokenStream(token); // Forward the streamed token to the front-end
        },
      },
    ],
  });

  // Non-streaming model setup
  const nonStreamingModel = new OpenAI({
    modelName: 'gpt-4-turbo',
    temperature: TEMPRATURE
  });

  const translationModel = new OpenAI({
    modelName: 'gpt-4-turbo',
    temperature: TEMPRATURE
  });

  function generateUniqueId(): string {
    return uuidv4();
  }
  return {
    call: async (question: string, Documents: MyDocument[], roomId: string, userEmail: string) => {
      const qaId = generateUniqueId();

      if (!roomMemories[roomId]) {
        roomMemories[roomId] = new BufferMemory({
          memoryKey: "chat_history",
          inputKey: "question",
          outputKey: "text",
        });
      }
      let chat_history = roomMemories[roomId];
      const language = await detectLanguageWithOpenAI(question, nonStreamingModel);

      if (language !== 'English' && language !== 'German') {
        question = await translateToEnglish(question, translationModel);
      }

      const formattedPrompt = QA_PROMPT
        .replace('{language}', language);
      
      // Since the first user question in not going through the CONDENSE_PROMPT and therefor abbriviations cannot be changed, i have added a generic user message.
      if ((chat_history.chatHistory as any).messages.length === 0) {
        const initialHumanMessage = new HumanMessage({
          content: "Hi",
          name: "Human",
      });
      chat_history.chatHistory.addMessage(initialHumanMessage); // Hypothetical method to add message
      }

      const customRetriever = new CustomRetriever(vectorstore);
      // Use the specific room memory for the chain
      const chain = ConversationalRetrievalQAChain.fromLLM(
        streamingModel,
        customRetriever,
        {
          memory: chat_history,
          questionGeneratorChainOptions: {
            llm: nonStreamingModel,
          },
          qaTemplate: formattedPrompt,
          questionGeneratorTemplate: CONDENSE_PROMPT,
          returnSourceDocuments: true,
          verbose: false
        }
      );

      const responseText = (await (async () => {
        const response = await chain.invoke({
            question: question,
        });
        return {
          text: response.text,
          sourceDocuments: response.sourceDocuments
        };
      })());
      const minScoreSourcesThreshold = process.env.MINSCORESOURCESTHRESHOLD !== undefined ? parseFloat(process.env.MINSCORESOURCESTHRESHOLD) : 0.78;
      let embeddingsStore;
      if (language == 'English' || language == 'German') {
        embeddingsStore = await customRetriever.storeEmbeddings(responseText.text, minScoreSourcesThreshold);
        for (const [doc, score] of embeddingsStore) {
          const myDoc = new MyDocument({
            pageContent: doc.pageContent,
            metadata: {
              source: doc.metadata.source,     
              type: doc.metadata.type,         
              videoLink: doc.metadata.videoLink,
              file: doc.metadata.file,
              score: score                     
            }
          });
        
          Documents.push(myDoc);
        }
      }
      else{
        embeddingsStore = await responseText.sourceDocuments;
        for (const doc of embeddingsStore) {
          const myDoc = new MyDocument({
              pageContent: doc.pageContent,
              metadata: {
                  source: doc.metadata.source,
                  type: doc.metadata.type,
                  videoLink: doc.metadata.videoLink,
                  file: doc.metadata.file,
                  score: doc.metadata.score
              }
          });
      
          Documents.push(myDoc);
        }      
      }


      if (roomId) {
        //console.log("INSIDE ROOM_ID", roomId);     
        io.to(roomId).emit(`fullResponse-${roomId}`, {
          roomId: roomId,
          sourceDocs: Documents,
          qaId: qaId
        });
      } else {
        io.emit("fullResponse", {
          sourceDocs: Documents,
          qaId: qaId
        });
      }

      await insertQA(question, responseText.text, responseText.sourceDocuments, Documents, qaId, roomId, userEmail);
    
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

        
        // Filter the chat history by score
        const SCORE_THRESHOLD = 0.02;
        //chatHistory = chatHistory.filter(entry => entry.score >= SCORE_THRESHOLD);
  
        // Manage chat history size
        const MAX_HISTORY_LENGTH = 10;
        // if (chatHistory.length > MAX_HISTORY_LENGTH) {
        //   chatHistory = chatHistory.slice(-MAX_HISTORY_LENGTH);
        // }
  
        // Update roomChatHistories with the filtered and truncated chatHistory
        //roomChatHistories[roomId] = chatHistory;
  
        return Documents;
      },
      vectorstore,
    };
};

