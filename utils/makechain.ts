//makechain.ts

import { OpenAI } from 'langchain/llms/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { CallbackManager } from "langchain/callbacks";
import { MyDocument } from 'utils/GCSLoader';
import { BufferMemory } from "langchain/memory";
import { PromptTemplate } from "langchain/prompts";

// type ChatEntry = {
//   question: string;
//   answer: string;
//   score: number;
// };

const roomMemories: Record<string, BufferMemory> = {};
//const roomChatHistories: Record<string, ChatEntry[]> = {};

const MODEL_NAME = process.env.MODEL_NAME;

const questionGeneratorTemplate = `Return text in the original language of the follow up question.
If the follow up question does not need context, return the exact same text back.
Never rephrase the follow up question given the chat history unless the follow up question needs context.
You are a helpful AI assistant trained to provide guidance on SolidCAM from your general knowledge and context.
In instances where the question diverges from the SolidCAM context, indicate that you're optimized 
to address queries exclusively related to SolidCAM.
Don't answer questions about iMachining only if SPECIFICALLY REQUESTED! If a solution or answer is beyond your knowledge scope, 
simply admit you don't know. Avoid creating fabricated answers. 

Chat History: {chat_history}
Follow Up question: {question}
Standalone question:`;

const TEMPRATURE = parseFloat(process.env.TEMPRATURE || "0");

export const makeChain = (vectorstore: PineconeStore, onTokenStream: (token: string) => void) => {
  const streamingModel = new OpenAI({
    streaming: true,
    modelName: MODEL_NAME,
    temperature: TEMPRATURE,
    callbacks: [
      {
        handleLLMNewToken: (token) => {
          onTokenStream(token); // Forward the streamed token to the front-end
        },
      },
    ],
  });

  // Non-streaming model setup
  const nonStreamingModel = new OpenAI({});

  return {
    call: async (question: string, Documents: MyDocument[], roomId: string) => {
      if (!roomMemories[roomId]) {
        roomMemories[roomId] = new BufferMemory({
          memoryKey: "chat_history",
          inputKey: "question",
          outputKey: "text",
          returnMessages: true,
        });
      }

      // if (!roomChatHistories[roomId]) {
      //   roomChatHistories[roomId] = [];
      // }
      let chat_history = roomMemories[roomId];

      // Use the specific room memory for the chain
      const chain = ConversationalRetrievalQAChain.fromLLM(
        streamingModel,
        vectorstore.asRetriever(),
        {
          memory: chat_history,
          questionGeneratorChainOptions: {
            llm: nonStreamingModel,
            template: questionGeneratorTemplate,
          },
          verbose: true
        }
      );

      const responseText = (await (async () => {
        const response = await chain.call({
            question: question,
        });
        return response.text;
      })());

      Documents.unshift({ responseText } as any);

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

      console.log('totalScore', totalScore);
      console.log('Documents', Documents);
  

        // Update the chat history with the new question, answer, and average score
        // chatHistory.push({
        //   question: question,
        //   answer: (Documents[0] as any).responseText,
        //   score: totalScore,
        // });
        
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

