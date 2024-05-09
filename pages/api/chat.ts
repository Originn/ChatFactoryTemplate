//pages/api/chat.ts
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
  res: NextApiResponse,
) {
  let roomIdError = false;

  const { question, roomId, userEmail } = req.body;

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
    //const index = pinecone.Index(PINECONE_INDEX_NAME);
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({ modelName: "text-embedding-3-small", dimensions: 1536 }),
      {
        pineconeIndex: pinecone,
        textKey: 'text',
        namespace: PINECONE_NAME_SPACE,
      },
    );

    // Create an instance of the QuestionEmbedder class
    const questionEmbedder = new QuestionEmbedder(
      vectorStore,
      new OpenAIEmbeddings({ modelName: "text-embedding-3-small", dimensions: 1536 }),
      userEmail
    );

    const embedQuestionResult = await questionEmbedder.embedQuestion(sanitizedQuestion, userEmail);
    if (embedQuestionResult) {
      // The sanitizedQuestion started with the code prefix and was embedded
      // You can skip executing the code block here
      const message = 'Text embedded successfully';
      if (roomId) {
        io.to(roomId).emit("newToken", message);
      } else {
        roomIdError = true;
      }
      return res.status(200).json({ message: 'Question embedded successfully' });
    }

    // Initialize chain for API calls, also define token handling through io instance
    
    const chain = makeChain(vectorStore, (token) => {
      // If a room ID exists, emit the new token to the specific room. Otherwise, emit to all.
      if (roomId) {
        io.to(roomId).emit("newToken", token);
      } else {
        roomIdError = true;
      }
    }, userEmail);

    // Make the API call using the chain, passing in the sanitized question, scored documents, and room ID
    let Documents = await chain.call(sanitizedQuestion, [], roomId, userEmail);

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
