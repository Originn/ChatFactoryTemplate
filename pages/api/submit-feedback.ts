// pages/api/submit-feedback.js

import { updateFeedback } from '../../db';

export default async function handler(req: any, res: any) {
    if (req.method === 'POST') {
      //console.log('Received feedback submission:', req.body);  // Log the incoming request body
      try {
        const { qaId, thumb, comment, roomId } = req.body;
        const result = await updateFeedback(qaId, thumb, comment, roomId);
        res.status(200).json(result);
      } catch (error: any) {  // Notice the 'any' type annotation
        console.error('Error in submit-feedback:', error.message, 'Stack:', error.stack);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    } else {
      // Handle any non-POST requests
      res.setHeader('Allow', 'POST');
      res.status(405).end('Method Not Allowed');
    }
  }
  