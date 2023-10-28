//makechain.ts

import { OpenAI } from 'langchain/llms/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { CallbackManager } from "langchain/callbacks";

type ChatEntry = {
  question: string;
  answer: string;
  score: number;
};

const roomChatHistories: Record<string, ChatEntry[]> = {};


let chatHistory: ChatEntry[] = [];

const MODEL_NAME = process.env.MODEL_NAME;
const nonStreamingModel = new OpenAI({});
const CONDENSE_PROMPT = `Given the history of the conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;

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
    vectorstore.asRetriever(),
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
    call: async (question: string, documentScores: Record<string, number>, roomId: string) => {
      if (!roomChatHistories[roomId]) {
        roomChatHistories[roomId] = [];
      }
      let chatHistory = roomChatHistories[roomId];

      const actualChatHistoryText = chatHistory.map(entry => `User: ${entry.question} Bot: ${entry.answer}`).join(' ');
      

      // Creating the formatted string to log
      const formattedString = `Given the history of the conversation and a follow up question, rephrase the follow up question to be a standalone question.

      Chat History:
      ${actualChatHistoryText}
      Follow Up Input: ${question}
      Standalone question:`;

      console.log("Debug: Formatted String: ", formattedString);

      const response = await chain.call({
        question: question,
        chat_history: actualChatHistoryText,
      });
  

        let totalScore = 0;
        if (response.sourceDocuments && response.sourceDocuments.length > 0) {
          for (let doc of response.sourceDocuments) {
            totalScore += documentScores[doc.pageContent] || 0;
          }
          totalScore /= response.sourceDocuments.length;
        }

        // Update the chat history with the new question, answer, and average score
        chatHistory.push({
          question: question,
          answer: response.text,
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
        roomChatHistories[roomId] = chatHistory;
        return response;
      }
    };
};

