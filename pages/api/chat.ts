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


// Perform similarity search on sanitized question and limit the results to 6
const results = await vectorStore.similaritySearchWithScore(sanitizedQuestion, 4);
console.log("Debug: Results:", results);

// Map the returned results to MyDocument[] format, storing the score in the metadata
const scoredDocuments: MyDocument[] = results.map(([document, score]) => {
  return {
    ...document,
    metadata: {
      ...document.metadata,
      score: score // Attach the similarity score to the metadata
    }
  };
});

console.log("Debug: ScoredDocuments:", scoredDocuments);

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
const response = await chain.call(sanitizedQuestion, scoredDocuments, roomId);

console.log("Debug: Complete API Response with Metadata: ", JSON.stringify(response, null, 2));

// If room ID is specified, emit the response to that room. Otherwise, emit to all.
if (roomId) {
  console.log("INSIDE ROOM_ID", roomId);     
  io.to(roomId).emit(`fullResponse-${roomId}`, {
    answer: response.text,
    sourceDocs: response.sourceDocuments // Emit the source documents along with the answer
  });
} else {
  io.emit("fullResponse", {
    answer: response.text,
    sourceDocs: response.sourceDocuments // Emit the source documents along with the answer
  });
}

    res.status(200).json(response);
  } catch (error: any) {
    console.log('error', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}