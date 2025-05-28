// pages/api/chat-stream.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { getPinecone } from '@/utils/pinecone-client';
import { PINECONE_NAME_SPACE } from '@/config/pinecone';
import { makeChainSSE } from '@/utils/makechain-sse';
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

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

  // Store original environment variable
  const originalOpenAIKey = process.env.OPENAI_API_KEY;

  // Helper function to send SSE events
  const sendSSEEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial connection event
  sendSSEEvent('connected', { roomId });

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
        openAIApiKey: process.env.OPENAI_API_KEY
      }),
      {
        pineconeIndex: pinecone,
        namespace: PINECONE_NAME_SPACE,
        textKey: 'text',
      },
    );

    // Token streaming callback
    const sendToken = (token: string) => {
      sendSSEEvent('token', { token });
    };

    // Create documents array for results
    const documents: MyDocument[] = [];

    // Create chain with SSE callbacks
    const chain = makeChainSSE(vectorStore, sendToken, userEmail);
    
    // Execute the chain
    const result = await chain.call(question, documents, roomId, userEmail, imageUrls);

    // Send the complete response
    sendSSEEvent('complete', {
      roomId: roomId,
      sourceDocs: documents,
      qaId: result.qaId,
      answer: result.answer,
    });

    // Send done event
    sendSSEEvent('done', {});

  } catch (error: any) {
    console.error('Error in chat-stream handler:', error);
    sendSSEEvent('error', { 
      message: error.message || 'Something went wrong',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    // Restore original environment variable
    process.env.OPENAI_API_KEY = originalOpenAIKey;
    // End the SSE stream
    res.end();
  }
}

// Disable body parsing to handle streaming
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};