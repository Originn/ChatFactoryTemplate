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

type SearchResult = [MyDocument, number];

function filteredSimilaritySearch(vectorStore: any, queryText: string, type: string, limit: number, minScore: number): SearchResult[] {
  // Ensure that vectorStore.similaritySearchWithScore returns an array
  const results = vectorStore.similaritySearchWithScore(queryText, limit, { type: type });

  if (!Array.isArray(results)) {
    // Handle the case where results is not an array
    console.error("vectorStore.similaritySearchWithScore did not return an array");
    return [];
  }

  // Explicitly type the destructured elements in the filter method
  const filteredResults = results.filter(([document, score]: SearchResult) => score >= minScore);

  return filteredResults;
}



export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let roomIdError = false;
  //console.log("req.body", req.body);
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
  //console.log('results:', results);
  //await waitForUserInput();

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
      roomIdError = true;
    }
  });

  // Make the API call using the chain, passing in the sanitized question, scored documents, and room ID
  await chain.call(sanitizedQuestion, Documents, roomId);

  const minScoreSourcesThreshold = process.env.MINSCORESOURCESTHRESHOLD !== undefined ? parseFloat(process.env.MINSCORESOURCESTHRESHOLD) : 0.86;

  const pdfResults = filteredSimilaritySearch(vectorStore, (Documents[0] as any).responseText, 'pdf', 2, minScoreSourcesThreshold);
  const webinarResults = filteredSimilaritySearch(vectorStore, (Documents[0] as any).responseText, 'youtube', 2, minScoreSourcesThreshold);

  const combinedResults = [...pdfResults, ...webinarResults];

  combinedResults.sort((a, b) => b[1] - a[1]);

  function generateUniqueId(): string {
    return uuidv4();
  }

  const sanitizedResults = results.map(([document, value]) => {
    // Check if document.pageContent is a string and replace null character
    if (typeof document.pageContent === 'string') {
      // This will remove all instances of the null character
      document.pageContent = document.pageContent.replace(/\x00/g, '');
    }
    return [document, value];
  });
  
  const sanitizedCombinedResults = combinedResults.map(([document, value]) => { 

    // Check if document.pageContent is a string and replace '\x00ng'
    if (typeof document.pageContent === 'string') {
      document.pageContent = document.pageContent.replace(/\x00/g, '');
    }
    return [document, value];
  });
  
  const qaId = generateUniqueId();
  await insertQA(question, (Documents[0] as any).responseText, sanitizedResults, sanitizedCombinedResults, qaId, roomId);
      
    
  //console.log("Debug: Results with Metadata: ", JSON.stringify(results, null, 3));
  Documents = combinedResults.map(([document, score]) => {
    return {
      ...document,
      metadata: {
        ...document.metadata,
        score: score 
      }
    };
  });

  //console.log("Debug: Documents with Metadata: ", JSON.stringify(Documents, null, 3));

  //If room ID is specified, emit the response to that room. Otherwise, emit to all.
  if (roomId) {
    console.log("INSIDE ROOM_ID", roomId);     
    io.to(roomId).emit(`fullResponse-${roomId}`, {
      roomId: roomId,
      sourceDocs: Documents,
      qaId: qaId
    });
  } else {
    io.emit("fullResponse", {
      sourceDocs: Documents,
      qaId: qaId
    });
  }


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