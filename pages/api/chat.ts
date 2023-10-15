//chat.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { makeChain } from '@/utils/makechain';
import { getPinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { getIO } from "@/socketServer.cjs";
import { Document } from 'utils/GCSLoader';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { question } = req.body;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }

  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  console.log('sanitizedQuestion:', sanitizedQuestion);

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

    const documentScores: Record<string, number> = {};

    const results = await vectorStore.similaritySearchWithScore(sanitizedQuestion, 4);
    for (const [document, score] of results) {
        documentScores[document.pageContent] = score;
    }



    // Create chain and use the already retrieved io instance
    const chain = makeChain(vectorStore, (token) => {
      io.emit("newToken", token);
    });

    const response = await chain.call(sanitizedQuestion, documentScores);

    response.sourceDocuments.forEach((doc: Document) => {
      doc.score = documentScores[doc.pageContent];
    });
    

    io.emit("fullResponse", {
      answer: response.text,
      sourceDocs: response.sourceDocuments
    });
    
    console.log('response', response);

    response.sourceDocuments.forEach((doc: Document) => {
      console.log(doc.metadata);
    });    
  
    res.status(200).json(response);
  } catch (error: any) {
    console.log('error', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}