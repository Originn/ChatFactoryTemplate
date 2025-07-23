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
import { createEmbeddingModel, validateEmbeddingConfig } from '@/utils/embeddingProviders';

// Function to synchronize chat history
async function syncChatHistory(roomId: string, clientHistory: any[], userEmail: string) {
  const serverHistory = await MemoryService.getChatHistory(roomId);

  if (clientHistory.length > serverHistory.length) {
    MemoryService.clearChatMemory(roomId);
    for (const [input, output] of clientHistory) {
      await MemoryService.updateChatMemory(roomId, input, output, [], userEmail);
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[chat-stream] Request method:', req.method);
  }

  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: `Method ${req.method} not allowed` });
    return;
  }

  const { question, history, roomId, imageUrls = [], userEmail } = req.body;

  // Validate required fields
  if (!roomId || !question) {
    res.status(400).json({ 
      error: 'Missing required fields',
      roomId: !!roomId,
      question: !!question 
    });
    return;
  }

  const originalOpenAIKey = process.env.OPENAI_API_KEY;

  try {
    // Configure response for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      // Important for Vercel
      'X-Vercel-Skip-Middleware': '1',
    });

    // Helper to write SSE
    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      // Flush the response
      if ((res as any).flush) (res as any).flush();
    };

    // Send initial connection
    sendEvent('connected', { roomId, timestamp: Date.now() });

    // Sync chat history
    await syncChatHistory(roomId, history || [], userEmail);

    // Get API key
    try {
      const apiKey = await getAPIKeyForProvider('openai', userEmail);
      process.env.OPENAI_API_KEY = apiKey;
    } catch (error) {
      console.error('[chat-stream] Error getting API key:', error);
    }

    // Validate embedding configuration
    const embeddingValidation = validateEmbeddingConfig();
    if (!embeddingValidation.isValid) {
      console.error('[chat-stream] Embedding configuration error:', embeddingValidation.error);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ 
        message: `Embedding configuration error: ${embeddingValidation.error}`,
        code: 'EMBEDDING_CONFIG_ERROR'
      })}\n\n`);
      res.end();
      return;
    }

    // Initialize Pinecone with dynamic embedding model
    const pinecone = await getPinecone();
    const embeddingModel = createEmbeddingModel();
    
    const vectorStore = await PineconeStore.fromExistingIndex(
      embeddingModel,
      {
        pineconeIndex: pinecone,
        namespace: PINECONE_NAME_SPACE,
        textKey: 'text',
      },
    );

    // Create documents array
    const documents: MyDocument[] = [];

    // Token callback
    const sendToken = (token: string) => {
      sendEvent('token', { token });
    };

    // Create and execute chain - pass embedding model to avoid double creation
    const chain = makeChainSSE(vectorStore, sendToken, userEmail, embeddingModel);
    const result = await chain.call(question, documents, roomId, userEmail, imageUrls);
    // Send complete response
    sendEvent('complete', {
      roomId,
      sourceDocs: documents,
      qaId: result.qaId,
      answer: result.answer,
    });

    // Send done
    sendEvent('done', { timestamp: Date.now() });

  } catch (error: any) {
    console.error('[chat-stream] Error:', error);
    
    // Try to send error event
    try {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ 
        message: error.message || 'An error occurred',
        code: error.code || 'UNKNOWN_ERROR'
      })}\n\n`);
    } catch (writeError) {
      console.error('[chat-stream] Failed to write error:', writeError);
    }
  } finally {
    // Restore API key
    process.env.OPENAI_API_KEY = originalOpenAIKey;
    
    // End response
    try {
      res.end();
    } catch (endError) {
      console.error('[chat-stream] Failed to end response:', endError);
    }
  }
}

// Important: Configure Next.js API route
export const config = {
  api: {
    bodyParser: true, // We need the body parsed
    responseLimit: false, // Allow streaming
  },
};