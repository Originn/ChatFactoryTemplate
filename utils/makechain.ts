//makechain.ts

import { OpenAI } from 'langchain/llms/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { CallbackManager } from "langchain/callbacks";
import { MyDocument } from 'utils/GCSLoader';
import { BufferMemory } from "langchain/memory";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { PromptTemplate } from "langchain/prompts";

type ChatEntry = {
  question: string;
  answer: string;
  score: number;
};

let bufferMemory = new BufferMemory({
  memoryKey: "chat_history",
  inputKey: "question",
  outputKey: "text",
  returnMessages: true,
});

const roomChatHistories: Record<string, ChatEntry[]> = {};

const MODEL_NAME = process.env.MODEL_NAME;
//const nonStreamingModel = new OpenAI({});

// const qaPrompt = PromptTemplate.fromTemplate(
//   `You are a helpful AI assistant trained to provide guidance on SolidCAM from your general knowledge and context. If it's a closure like Thanks, say your welcome and offer assistance.
// Don't answer questions about iMachining only if SPECIFICALLY REQUESTED! When answering, adhere to the following context and guidelines.\nIf you show a command, 
// tell the user where to execute it!\nIf a step-by-step process is needed, try to be as verbose as possible, indicating right,left or double click where needed. 
// Format your answer with numbered steps as shown below:\n1. Start by...\n2. Proceed to...\n3. Following that, ...\nIf a solution or answer is beyond your knowledge scope, 
// simply admit you don't know. Avoid creating fabricated answers.\nIn instances where the question diverges from the SolidCAM context, kindly indicate that you're optimized 
// to address queries exclusively related to SolidCAM.

// Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer. 
//   ----------------
//   CONTEXT: {context}
//   ----------------
//   CHAT HISTORY: {chat_history}
//   ----------------
//   QUESTION: {question}
//   ----------------
//   Helpful Answer:`
// );

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


// const CONDENSE_PROMPT = `If it's a closure like Thanks, say your welcome and offer assistance. Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question. 
// ----------
// CHAT HISTORY: {chat_history}
// ----------
// FOLLOWUP QUESTION: {question}
// ----------
// Standalone question:`;


// const QA_PROMPT = `You are a helpful AI assistant trained to provide guidance on SolidCAM from your general knowledge and context.
// Don't answer questions about iMachining only if SPECIFICALLY REQUESTED! When answering, adhere to the following context and guidelines.\nIf you show a command, 
// tell the user where to execute it!\nIf a step-by-step process is needed, try to be as verbose as possible, indicating right,left or double click where needed. 
// Format your answer with numbered steps as shown below:\n1. Start by...\n2. Proceed to...\n3. Following that, ...\nIf a solution or answer is beyond your knowledge scope, 
// simply admit you don't know. Avoid creating fabricated answers.\nIn instances where the question diverges from the SolidCAM context, kindly indicate that you're optimized 
// to address queries exclusively related to SolidCAM.

// Given the following conversation, check if the Follow Up Input is a question. If it's not, and it's a thanks remark, replay with 'Happy to Help'. If it is a follow up question, return the conversation history excerpt that includes any relevant context to the question if it exists and rephrase the follow up question to be a standalone question.
// Chat History:
// {chat_history}
// Follow Up Input: {question}
// Your answer should follow the following format:
// \`\`\`
// Use the following pieces of context to answer the users question.
// If you don't know the answer, just say that you don't know, don't try to make up an answer.
// ----------------
// <Relevant chat history excerpt as context here>
// Standalone question: <Rephrased question here>
// \`\`\`
// Your answer:`;


// const CUSTOM_QUESTION_GENERATOR_CHAIN_PROMPT = `Given the following conversation and a follow up question, return the conversation history excerpt that includes any relevant context to the question if it exists and rephrase the follow up question to be a standalone question.
// Chat History:
// {chat_history}
// Follow Up Input: {question}
// Your answer should follow the following format:
// \`\`\`
// Use the following pieces of context to answer the users question.
// If you don't know the answer, just say that you don't know, don't try to make up an answer.
// ----------------
// <Relevant chat history excerpt as context here>
// Standalone question: <Rephrased question here>
// \`\`\`
// Your answer:`;
const TEMPRATURE = parseFloat(process.env.TEMPRATURE || "0");

export const makeChain = (vectorstore: PineconeStore, onTokenStream: (token: string) => void) => {
  const streamingModel = new ChatOpenAI({
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
  const nonStreamingModel = new ChatOpenAI({});

  // Chain setup with BufferMemory for managing conversation history
  const chain = ConversationalRetrievalQAChain.fromLLM(
    streamingModel,
    vectorstore.asRetriever(),
    {
      memory: bufferMemory,
      questionGeneratorChainOptions: {
        llm: nonStreamingModel,
        template: questionGeneratorTemplate,
      },
      //verbose: true
    
    }
  );
  return {
    call: async (question: string, Documents: MyDocument[], roomId: string) => {
      if (!roomChatHistories[roomId]) {
        roomChatHistories[roomId] = [];
      }
      let chatHistory = roomChatHistories[roomId];
      
      const actualChatHistoryText = chatHistory.map(entry => `Human: ${entry.question}\nAI: ${entry.answer}`).join('\n\n');

      const responseText = (await (async () => {
        const response = await chain.call({
            question: question,
            //chat_history: actualChatHistoryText,
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

