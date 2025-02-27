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

    // Collect user data from various tables
    const userData: any = {
      email,
      chatHistory: [],
      questions: [],
      settings: {},
      accountInfo: {}
    };

    // Get user's chat history
    const chatHistoryQuery = await pool.query(
      `SELECT * FROM user_chat_history WHERE useremail = $1 ORDER BY date DESC;`,
      [email]
    );
    userData.chatHistory = chatHistoryQuery.rows;

    // Get user's Q&A history
    const questionsQuery = await pool.query(
      `SELECT * FROM QuestionsAndAnswers WHERE userEmail = $1 ORDER BY created_at DESC;`,
      [email]
    );
    userData.questions = questionsQuery.rows;

    // Get user's privacy settings
    const settingsQuery = await pool.query(
      `SELECT * FROM user_privacy_settings WHERE email = $1;`,
      [email]
    );
    userData.settings = settingsQuery.rows[0] || {};

    // Get Firebase user information
    try {
      const firebaseUser = await admin.auth().getUserByEmail(email);
      userData.accountInfo = {
        uid: firebaseUser.uid,
        createdAt: firebaseUser.metadata.creationTime,
        lastSignIn: firebaseUser.metadata.lastSignInTime,
        emailVerified: firebaseUser.emailVerified,
        displayName: firebaseUser.displayName,
      };
    } catch (error) {
      console.error('Error fetching Firebase user data:', error);
      userData.accountInfo = { error: 'Could not fetch Firebase user data' };
    }

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=solidcam-data-${Date.now()}.json`);
    
    // Send the data
    return res.status(200).json(userData);
  } catch (error) {
    console.error('Error exporting user data:', error);
    return res.status(500).json({ message: 'Error processing the request' });
  }
}