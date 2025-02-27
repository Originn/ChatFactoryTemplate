// pages/api/delete-chat-history.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../db';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { email, timeframe } = req.body;

    if (!email || !timeframe) {
      return res.status(400).json({ message: 'Email and timeframe are required' });
    }

    // Verify the user is authenticated
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      // Verify the token
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Check if the token belongs to the requested user
      if (decodedToken.email !== email) {
        return res.status(403).json({ message: 'Unauthorized access' });
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ message: 'Invalid authentication' });
    }

    // Construct the delete query based on timeframe
    let query = '';
    
    switch (timeframe) {
      case 'all':
        query = 'DELETE FROM user_chat_history WHERE useremail = $1';
        break;
      case 'hour':
        query = 'DELETE FROM user_chat_history WHERE useremail = $1 AND date > NOW() - INTERVAL \'1 hour\'';
        break;
      case 'day':
        query = 'DELETE FROM user_chat_history WHERE useremail = $1 AND date > NOW() - INTERVAL \'1 day\'';
        break;
      case 'week':
        query = 'DELETE FROM user_chat_history WHERE useremail = $1 AND date > NOW() - INTERVAL \'1 week\'';
        break;
      case 'month':
        query = 'DELETE FROM user_chat_history WHERE useremail = $1 AND date > NOW() - INTERVAL \'1 month\'';
        break;
      default:
        return res.status(400).json({ message: 'Invalid timeframe' });
    }
    
    // Execute the delete operation
    const result = await pool.query(query, [email]);
    
    return res.status(200).json({ 
      message: 'Chat history deleted successfully',
      deletedCount: result.rowCount
    });
    
  } catch (error) {
    console.error('Error deleting chat history:', error);
    return res.status(500).json({ message: 'Error processing the request' });
  }
}