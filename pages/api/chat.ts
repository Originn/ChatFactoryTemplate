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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log("req.body", req.body);
  const { question, history, roomId } = req.body;


  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }

  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  try {
    const io = getIO();
    const pinecone = await getPinecone();
    const index = pinecone.Index(PINECONE_INDEX_NAME);
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({}),
      {
        pineconeIndex: index,
        textKey: 'text',
        namespace: PINECONE_NAME_SPACE,
      },
    );


// Perform similarity search on sanitized question and limit the results to 4
let results = await vectorStore.similaritySearchWithScore(sanitizedQuestion, 4);

// Map the returned results to MyDocument[] format, storing the score in the metadata
let Documents: MyDocument[] = results.map(([document, score]) => {
  return {
    ...document,
    metadata: {
      ...document.metadata,
      score: score
    }
  };
});


// Initialize chain for API calls, also define token handling through io instance
const chain = makeChain(vectorStore, (token) => {
  // If a room ID exists, emit the new token to the specific room. Otherwise, emit to all.
  if (roomId) {
    io.to(roomId).emit("newToken", token);
  } else {
    io.emit("newToken", token);
  }
});

// Make the API call using the chain, passing in the sanitized question, scored documents, and room ID
await chain.call(sanitizedQuestion, Documents, roomId);

results = await vectorStore.similaritySearchWithScore((Documents[0] as any).responseText, 4);

console.log("Debug: Complete API Response with Metadata: ", JSON.stringify(results, null, 3));
Documents = results.map(([document, score]) => {
  return {
    ...document,
    metadata: {
      ...document.metadata,
      score: score 
    }
  };
});
console.log("Debug: Complete API Response with Metadata: ", JSON.stringify(Documents, null, 3));

//If room ID is specified, emit the response to that room. Otherwise, emit to all.
if (roomId) {
  console.log("INSIDE ROOM_ID", roomId);     
  io.to(roomId).emit(`fullResponse-${roomId}`, {
    sourceDocs: Documents
  });
} else {
  io.emit("fullResponse", {
    sourceDocs: Documents
  });
}

    res.status(200).json(Documents);
  } catch (error: any) {
    console.log('error', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}