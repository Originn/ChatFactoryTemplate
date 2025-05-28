// pages/api/export-user-data.ts

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
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
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
        return res.status(403).json({ message: 'Unauthorized access to user data' });
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ message: 'Invalid authentication' });
    }

    // Get user's Q&A history with only the required fields
    const questionsQuery = await pool.query(
      `SELECT question, answer, thumb, comment, userEmail 
       FROM QuestionsAndAnswers 
       WHERE userEmail = $1 
       ORDER BY created_at DESC;`,
      [email]
    );
    
    // Format the data as an array of objects with the selected fields
    const userData = questionsQuery.rows.map(row => ({
      question: row.question,
      answer: row.answer,
      thumb: row.thumb,
      comment: row.comment,
      userEmail: row.useremail || row.userEmail // Handle potential column name inconsistency
    }));

    // Set response headers for file download with pretty-printing enabled
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=chatbot-data-${Date.now()}.json`);
    
    // Send the data with 2-space indentation for nice formatting
    return res.status(200).send(JSON.stringify(userData, null, 2));
  } catch (error) {
    console.error('Error exporting user data:', error);
    return res.status(500).json({ message: 'Error processing the request' });
  }
}