// pages/api/test-sse.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send a test message
    res.write('event: test\n');
    res.write('data: {"message": "SSE is working!"}\n\n');
    
    // Send a few more messages
    setTimeout(() => {
      res.write('event: test\n');
      res.write('data: {"message": "Second message"}\n\n');
    }, 1000);

    setTimeout(() => {
      res.write('event: done\n');
      res.write('data: {"message": "Stream complete"}\n\n');
      res.end();
    }, 2000);

  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}