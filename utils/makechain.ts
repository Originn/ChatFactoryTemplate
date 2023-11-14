//makechain.ts

import { OpenAI } from 'langchain/llms/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { CallbackManager } from "langchain/callbacks";
import { MyDocument } from 'utils/GCSLoader';

type ChatEntry = {
  question: string;
  answer: string;
  score: number;
};

const roomChatHistories: Record<string, ChatEntry[]> = {};

const MODEL_NAME = process.env.MODEL_NAME;
const nonStreamingModel = new OpenAI({});
const CONDENSE_PROMPT = `Given the history of the conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Helpful answer in markdown:`;

const QA_PROMPT = `${process.env.QA_PROMPT || ""}

{context}

Question: {question}
Helpful answer:`;

const TEMPRATURE = parseFloat(process.env.TEMPRATURE || "0");

export const makeChain = (vectorstore: PineconeStore, onTokenStream: (token: string) => void) => {
  const model = new OpenAI({
    temperature: TEMPRATURE,
    modelName: MODEL_NAME, 
    streaming: true,
    callbackManager: CallbackManager.fromHandlers({
      handleLLMNewToken: async (token) => {
        onTokenStream(token);
      },
    }),
  });

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorstore.asRetriever(4),
    {
      questionGeneratorChainOptions: {
        llm: nonStreamingModel,
      },
      qaTemplate: QA_PROMPT,
      questionGeneratorTemplate: CONDENSE_PROMPT,
      returnSourceDocuments: true,
    }
  );
  return {
    call: async (question: string, Documents: MyDocument[], roomId: string) => {
      if (!roomChatHistories[roomId]) {
        roomChatHistories[roomId] = [];
      }
      let chatHistory = roomChatHistories[roomId];

      const actualChatHistoryText = chatHistory.map(entry => `User: ${entry.question} Bot: ${entry.answer}`).join(' ');

      const responseText = (await (async () => {
        const response = await chain.call({
            question: question,
            chat_history: actualChatHistoryText,
        });
        return response.text;
      })());

      console.log("Debug: chat_history used in API call:", actualChatHistoryText);

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
        chatHistory.push({
          question: question,
          answer: (Documents[0] as any).responseText,
          score: totalScore,
        });
        
        // Filter the chat history by score
        const SCORE_THRESHOLD = 0.02;
        chatHistory = chatHistory.filter(entry => entry.score >= SCORE_THRESHOLD);
  
        // Manage chat history size
        const MAX_HISTORY_LENGTH = 10;
        if (chatHistory.length > MAX_HISTORY_LENGTH) {
          chatHistory = chatHistory.slice(-MAX_HISTORY_LENGTH);
        }
  
        // Update roomChatHistories with the filtered and truncated chatHistory
        roomChatHistories[roomId] = chatHistory;
  
        return Documents;
      },
      vectorstore,
    };
};

