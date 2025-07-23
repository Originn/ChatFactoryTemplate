/**
 * Utility for handling long-running requests with stream-like behavior to prevent Heroku timeout.
 * This allows responses to be started earlier and keeps the connection alive while processing continues.
 */

import { NextApiResponse } from 'next';

/**
 * Creates and manages a streaming response to prevent timeout on long-running requests
 * 
 * @param res Next.js API response object
 * @returns An object with methods to manage the streaming response
 */
export function createStreamManager(res: NextApiResponse) {
  // Set up headers for streaming
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  
  // Start with status 200
  res.status(200);
  
  // Send an initial message to start the response
  res.write('Processing request...\n');
  
  // Create a heartbeat to keep the connection alive
  const heartbeatInterval = setInterval(() => {
    // Send whitespace as a heartbeat to keep the connection alive
    res.write(' ');
  }, 10000); // every 10 seconds
  
  return {
    /**
     * Sends a progress update message to the client
     */
    sendUpdate: (message: string) => {
      res.write(`${message}\n`);
    },
    
    /**
     * Completes the response stream
     */
    complete: (data: any) => {
      clearInterval(heartbeatInterval);
      res.write(JSON.stringify(data));
      res.end();
    },
    
    /**
     * Ends the stream with an error
     */
    error: (error: Error | string) => {
      clearInterval(heartbeatInterval);
      const errorMessage = typeof error === 'string' ? error : error.message;
      res.write(JSON.stringify({ error: errorMessage }));
      res.end();
    }
  };
}
