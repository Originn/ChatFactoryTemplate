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

let chatHistory: ChatEntry[] = [];

const MODEL_NAME = process.env.MODEL_NAME;
const nonStreamingModel = new OpenAI({});
const CONDENSE_PROMPT = `Given the history of the conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;

const QA_PROMPT = `${process.env.QA_PROMPT || ""}{context}

Question: {question}
Helpful answer in markdown:`;

const TEMPRATURE = parseFloat(process.env.TEMPRATURE || "0");

console.log('TEMPRATURE:', TEMPRATURE);
console.log('QA_PROMPT:', QA_PROMPT);

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
    call: async (question: string) => {
      const response = await chain.call({
        question: question,
        chat_history: chatHistory.map(entry => entry.question + " " + entry.answer),
      });

      // Update the chat history with the new question, answer, and score
      chatHistory.push({
        question: question,
        answer: response.text,
        score: response.sourceDocuments[0]?.score || 0,
      });

      // Filter the chat history by score
      const SCORE_THRESHOLD = 0.1;
      chatHistory = chatHistory.filter(entry => entry.score >= SCORE_THRESHOLD);

      // Manage chat history size
      const MAX_HISTORY_LENGTH = 50;
      if (chatHistory.length > MAX_HISTORY_LENGTH) {
        chatHistory = chatHistory.slice(-MAX_HISTORY_LENGTH);
      }

      return response;
    }
  };
};

