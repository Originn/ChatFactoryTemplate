//chat.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { makeChain } from '@/utils/makechain';
import { getPinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { getIO } from "@/socketServer.cjs";
import { MyDocument } from 'utils/GCSLoader';
import {waitForUserInput} from 'utils/textsplitter';
import { AIMessage, HumanMessage } from 'langchain/schema';
import { insertQA } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '@auth0/nextjs-auth0';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let roomIdError = false;

  const { question, roomId } = req.body;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }

  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  try {
    const session = await getSession(req, res);
    const io = getIO();
    const pinecone = await getPinecone();
    const index = pinecone.Index(PINECONE_INDEX_NAME);
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({ modelName: "text-embedding-3-large", dimensions: 1024 }),
      {
        pineconeIndex: index,
        textKey: 'text',
        namespace: PINECONE_NAME_SPACE,
      },
    );
  


  // Initialize chain for API calls, also define token handling through io instance
  const chain = makeChain(vectorStore, (token) => {
    // If a room ID exists, emit the new token to the specific room. Otherwise, emit to all.
    if (roomId) {
      io.to(roomId).emit("newToken", token);
    } else {
      roomIdError = true;
    }
  });

  // Make the API call using the chain, passing in the sanitized question, scored documents, and room ID
  let Documents = await chain.call(sanitizedQuestion, [], roomId, session);

  //If room ID is specified, emit the response to that room. Otherwise, emit to all.
  if (roomIdError) {
    res.status(400).json({ error: 'roomId was not found' });  // Return 400 Bad Request
    return;
  }

  res.status(200).json({ sourceDocs: Documents});
  } catch (error: any) {
    console.log('error', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}