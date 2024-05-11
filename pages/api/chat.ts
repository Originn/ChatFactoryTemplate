// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { makeChain } from '@/utils/makechain';
import { getPinecone } from '@/utils/pinecone-client';
import { PINECONE_NAME_SPACE } from '@/config/pinecone';
import { getIO } from "@/socketServer.cjs";
import { QuestionEmbedder } from "@/scripts/QuestionEmbedder"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { question, roomId, userEmail } = req.body;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }

  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');
  const codePrefix = '8374-8924-7365-2734';
  const io = getIO();

  try {
    const pinecone = await getPinecone();
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({ modelName: "text-embedding-3-small", dimensions: 1536 }),
      {
        pineconeIndex: pinecone,
        namespace: PINECONE_NAME_SPACE,
        textKey: 'text',
      },
    );

    if (sanitizedQuestion.startsWith(codePrefix)) {
      const formatCheck = sanitizedQuestion.slice(codePrefix.length).trim();
      const headerIndex = formatCheck.indexOf('header:');
      const textIndex = formatCheck.indexOf(' text:');

      if (headerIndex === -1 || textIndex === -1 || headerIndex >= textIndex) {
        const message = `The format of your question is incorrect. Please use the format: 8374-8924-7365-2734 header: YOUR_HEADER text: YOUR_TEXT`;
        if (roomId) {
          io.to(roomId).emit("newToken", message);
        }
        return res.status(400).json({ message });
      }

      const questionEmbedder = new QuestionEmbedder(
        vectorStore,
        new OpenAIEmbeddings({ modelName: "text-embedding-3-small", dimensions: 1536 }),
        userEmail
      );

      const embedQuestionResult = await questionEmbedder.embedQuestion(sanitizedQuestion, userEmail);
      if (embedQuestionResult) {
        const message = 'Text embedded successfully';
        if (roomId) {
          io.to(roomId).emit("newToken", message);
        }
        return res.status(200).json({ message });
      } else {
        return res.status(500).json({ message: 'Failed to embed the text' });
      }
    } else {
      // Initialize chain for API calls, also define token handling through io instance
      const chain = makeChain(vectorStore, (token) => {
        if (roomId) {
          io.to(roomId).emit("newToken", token);
        }
      }, userEmail);

      // Make the API call using the chain, passing in the sanitized question, scored documents, and room ID
      const Documents = await chain.call(sanitizedQuestion, [], roomId, userEmail);
      return res.status(200).json({ sourceDocs: Documents });
    }
  } catch (error : any) {
    console.error('Error', error);
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
