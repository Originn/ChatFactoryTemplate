// app/api/chat-stream/route.ts
import { NextRequest } from 'next/server';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { getPinecone } from '@/utils/pinecone-client';
import { PINECONE_NAME_SPACE } from '@/config/pinecone';
import { makeChainSSE } from '@/utils/makechain-sse';
import { MyDocument } from '@/interfaces/Document';
import MemoryService from '@/utils/memoryService';
import { getUserAIProvider, getAPIKeyForProvider } from '@/db';
import { createEmbeddingModel, validateEmbeddingConfig } from '@/utils/embeddingProviders';

// Force dynamic rendering for streaming - CRITICAL for Vercel
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Disable static optimization
export const revalidate = 0;

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

export async function POST(request: NextRequest) {
  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  const originalEmbeddingProvider = process.env.EMBEDDING_PROVIDER;

  try {
    const body = await request.json();
    const { question, history, roomId, imageUrls = [], userEmail } = body;

    // Validate required fields
    if (!roomId || !question) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          roomId: !!roomId,
          question: !!question 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log current embedding configuration
    console.log(`🔧 Embedding Config: Provider=${process.env.EMBEDDING_PROVIDER}, Model=${process.env.EMBEDDING_MODEL}, Dimensions=${process.env.EMBEDDING_DIMENSIONS}`);

    // Get API key - only modify OpenAI key, preserve other env vars
    try {
      const apiKey = await getAPIKeyForProvider('openai', userEmail);
      process.env.OPENAI_API_KEY = apiKey;
      // Ensure embedding provider is preserved after API key change
      if (originalEmbeddingProvider) {
        process.env.EMBEDDING_PROVIDER = originalEmbeddingProvider;
      }
    } catch (error) {
      console.error('[chat-stream] Error getting API key:', error);
    }

    // Validate embedding configuration
    const embeddingValidation = validateEmbeddingConfig();
    if (!embeddingValidation.isValid) {
      console.error('[chat-stream] Embedding configuration error:', embeddingValidation.error);
      return new Response(
        JSON.stringify({ 
          message: `Embedding configuration error: ${embeddingValidation.error}`,
          code: 'EMBEDDING_CONFIG_ERROR'
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Sync chat history
    await syncChatHistory(roomId, history || [], userEmail);

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

    // Create ReadableStream with proper Vercel streaming implementation
    const encoder = new TextEncoder();
    
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
    
    const stream = new ReadableStream({
      start(controller) {
        controllerRef = controller;
        
        // Helper function to send SSE events safely
        const sendEvent = (event: string, data: any) => {
          if (controllerRef && (!controllerRef.desiredSize || controllerRef.desiredSize > 0)) {
            try {
              const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
              controllerRef.enqueue(encoder.encode(eventData));
            } catch (err) {
              console.error('[chat-stream] Error sending event:', err);
            }
          }
        };

        // Async function to handle the streaming logic
        const handleStreaming = async () => {
          try {
            // Send initial connection
            sendEvent('connected', { roomId, timestamp: Date.now() });

            // Send heartbeat to establish connection
            await new Promise(resolve => setTimeout(resolve, 100));
            sendEvent('heartbeat', { timestamp: Date.now() });

            // Token callback for streaming
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

            // Close the stream safely
            if (controllerRef) {
              controllerRef.close();
              controllerRef = null;
            }

          } catch (error: any) {
            console.error('[chat-stream] Stream error:', error);
            
            // Send error event
            if (controllerRef) {
              try {
                const errorEvent = `event: error\ndata: ${JSON.stringify({ 
                  message: error.message || 'An error occurred',
                  code: error.code || 'UNKNOWN_ERROR'
                })}\n\n`;
                controllerRef.enqueue(encoder.encode(errorEvent));
                controllerRef.close();
                controllerRef = null;
              } catch (closeError) {
                console.error('[chat-stream] Error closing stream after error:', closeError);
              }
            }
          } finally {
            // Restore original environment variables
            process.env.OPENAI_API_KEY = originalOpenAIKey;
            if (originalEmbeddingProvider) {
              process.env.EMBEDDING_PROVIDER = originalEmbeddingProvider;
            }
          }
        };

        // Start the streaming process
        handleStreaming();
      },
      
      cancel() {
        // Clean up when stream is cancelled
        console.log('[chat-stream] Stream cancelled');
        if (controllerRef) {
          controllerRef = null;
        }
        // Restore environment variables on cancellation
        process.env.OPENAI_API_KEY = originalOpenAIKey;
        if (originalEmbeddingProvider) {
          process.env.EMBEDDING_PROVIDER = originalEmbeddingProvider;
        }
      }
    });

    // Return streaming response with proper headers for Vercel
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        // Critical for Vercel streaming
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (error: any) {
    console.error('[chat-stream] Request error:', error);
    
    // Restore environment variables on error
    process.env.OPENAI_API_KEY = originalOpenAIKey;
    if (originalEmbeddingProvider) {
      process.env.EMBEDDING_PROVIDER = originalEmbeddingProvider;
    }

    return new Response(
      JSON.stringify({ 
        message: error.message || 'An error occurred',
        code: error.code || 'UNKNOWN_ERROR'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}