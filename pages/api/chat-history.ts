//pages\api\chat-history.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { getChatHistory } from '../../db'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    const { userEmail, range } = req.query;

    if (!userEmail || !range) {
      return res.status(400).json({ error: 'Missing userEmail or range' });
    }

    if (typeof userEmail !== 'string' || !['today', 'yesterday', '7days', '30days', 'all'].includes(range as string)) {
      return res.status(400).json({ error: 'Invalid userEmail or range' });
    }

    try {
      const history = await getChatHistory(userEmail, range as string);
      res.status(200).json(history);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      res.status(500).json({ error: 'Failed to fetch chat history' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}