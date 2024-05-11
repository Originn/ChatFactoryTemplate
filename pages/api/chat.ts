// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { QuestionEmbedder } from "@/scripts/QuestionEmbedder";
import { getPinecone } from '@/utils/pinecone-client';
import { PINECONE_NAME_SPACE } from '@/config/pinecone';
import { getIO } from "@/socketServer.cjs";

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
  
  if (!sanitizedQuestion.startsWith(codePrefix)) {
    const message = `The format of your question is incorrect. Please use the format: ${codePrefix}\nheader: YOUR_HEADER\n text: YOUR_TEXT`;
    if (roomId) {
      io.to(roomId).emit("newToken", message);
    }
    return res.status(400).json({ message });
  }

  const headerTextSplit = sanitizedQuestion.slice(codePrefix.length).trim().split(' text:');
  if (headerTextSplit.length < 2 || !headerTextSplit[0].startsWith('header:')) {
    const message = `The format of your question is incorrect. Please use the format: ${codePrefix}\nheader: YOUR_HEADER\n text: YOUR_TEXT`;
    if (roomId) {
      io.to(roomId).emit("newToken", message);
    }
    return res.status(400).json({ message });
  }

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
      const message = 'Failed to embed the text';
      if (roomId) {
        io.to(roomId).emit("newToken", message);
      }
      return res.status(500).json({ message });
    }
  } catch (error : any) {
    console.log('error', error);
    const message = 'Internal server error';
    if (roomId) {
      io.to(roomId).emit("newToken", message);
    }
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
