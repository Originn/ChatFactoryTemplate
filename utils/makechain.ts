import { OpenAI } from 'langchain/llms/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { ConversationalRetrievalQAChain } from 'langchain/chains';

const MODEL_NAME = process.env.MODEL_NAME;

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

export const makeChain = (vectorstore: PineconeStore) => {
  const model = new OpenAI({
    temperature: TEMPRATURE, // increase temepreature to get more creative answers
    modelName: MODEL_NAME, 
  });

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorstore.asRetriever(),
    {
      qaTemplate: QA_PROMPT,
      questionGeneratorTemplate: CONDENSE_PROMPT,
      returnSourceDocuments: true, //The number of source documents returned is 4 by default
    },
  );
  return chain;
};
