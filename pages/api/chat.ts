// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { getPinecone } from '@/utils/pinecone-client';
import { PINECONE_NAME_SPACE } from '@/config/pinecone';
import { makeChain } from '@/utils/makechain';
import { MyDocument } from '@/interfaces/Document';
import MemoryService from '@/utils/memoryService';
import { getUserAIProvider, getAPIKeyForProvider } from '@/db';

// Function to synchronize chat history
async function syncChatHistory(roomId: string, clientHistory: any[], userEmail: string) {
  const serverHistory = await MemoryService.getChatHistory(roomId);

  if (clientHistory.length > serverHistory.length) {
    // Clear existing server history
    MemoryService.clearChatMemory(roomId);
    // Reconstruct the history from client data
    for (const [input, output] of clientHistory) {
      await MemoryService.updateChatMemory(roomId, input, output, [], userEmail);
    }
  } else {
    console.log('Server history is up to date');
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, history, roomId, imageUrls = [], userEmail } = req.body;

  if (!roomId) {
    return res.status(400).json({ message: 'No roomId in the request' });
  }

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }

  // Store original environment variable
  const originalOpenAIKey = process.env.OPENAI_API_KEY;

  try {
    // Sync chat history first
    await syncChatHistory(roomId, history, userEmail);

    // Get the appropriate API key for the user
    try {
      const apiKey = await getAPIKeyForProvider('openai', userEmail);
      process.env.OPENAI_API_KEY = apiKey;
    } catch (error) {
      console.error('Error getting API key:', error);
      // Continue with default key if we can't get the user-specific key
    }

    // Initialize Pinecone
    const pinecone = await getPinecone();
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({ 
        modelName: "text-embedding-3-small", 
        dimensions: 1536,
        openAIApiKey: process.env.OPENAI_API_KEY // Use the current OpenAI key
      }),
      {
        pineconeIndex: pinecone,
        namespace: PINECONE_NAME_SPACE,
        textKey: 'text',
      },
    );

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const sendToken = (token: string) => {
      res.write(`data: ${token}\n\n`);
    };

    const sendFullResponse = (data: { roomId: string; sourceDocs: MyDocument[]; qaId: string; answer: string }) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Create documents array for results
    const documents: MyDocument[] = [];

    // Create chain with OpenAI
    const chain = makeChain(vectorStore, sendToken, sendFullResponse, userEmail);
    
    // Execute the chain and close the stream when done
    await chain.call(question, documents, roomId, userEmail, imageUrls);
    res.end();
    return;
  } catch (error: any) {
    console.error('Error in chat handler:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Something went wrong' })}\n\n`);
    res.end();
    return;
  } finally {
    // Restore original environment variable to prevent leaking between requests
    process.env.OPENAI_API_KEY = originalOpenAIKey;
  }
}