import type { NextApiRequest, NextApiResponse } from 'next';
import { getChatHistoryByRoomId } from '../../db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    const { userEmail, roomId } = req.query;

    if (!userEmail || !roomId) {
      return res.status(400).json({ error: 'Missing userEmail or roomId' });
    }

    if (typeof userEmail !== 'string' || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'Invalid userEmail or roomId' });
    }

    try {
      const history = await getChatHistoryByRoomId(roomId);
      if (!history) {
        return res.status(404).json({ error: 'Chat history not found' });
      }
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