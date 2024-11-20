// pages/api/chat.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { makeChain } from '@/utils/makechain';
import { getPinecone } from '@/utils/pinecone-client';
import { PINECONE_NAME_SPACE } from '@/config/pinecone';
import { getIO } from "@/socketServer.cjs";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { question, history, roomId, imageUrls, userEmail } = req.body;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!roomId) {
    return res.status(400).json({ message: 'No roomId in the request' });
  }

  //await syncChatHistory(roomId, history, userEmail);

  const sanitizedQuestion = question?.trim().replaceAll('\n', ' ');
  const io = getIO();

  try {
    if (!question) {
      return res.status(400).json({ message: 'No question in the request' });
    }

    // Proceed to the embedding logic for cases without images
    const pinecone = await getPinecone();
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({ modelName: "text-embedding-3-small", dimensions: 1536 }),
      {
        pineconeIndex: pinecone,
        namespace: PINECONE_NAME_SPACE,
        textKey: 'text',
      },
    );

    const chain = makeChain(vectorStore, (token) => {
      if (roomId) {
        io.to(roomId).emit("newToken", token);
      }
    }, userEmail);

    await chain.call(sanitizedQuestion, [], roomId, userEmail, imageUrls);
    return res.status(200).json({ message: 'Embedding complete' });

  } catch (error: any) {
    console.error('Error', error);
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
