// pages/api/user-data-stats.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../db';
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    } else {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS not set');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error', error);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email parameter is required' });
    }

    // Verify the user is authenticated
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.error('Authentication header missing');
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      // Extract and verify the token
      const token = authHeader.split('Bearer ')[1];
      if (!token) {
        console.error('Token format invalid');
        return res.status(401).json({ message: 'Invalid token format' });
      }

      // Verify the token with Firebase
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Check if the token belongs to the requested user
      if (decodedToken.email !== email) {
        console.error('Token email mismatch', { tokenEmail: decodedToken.email, requestedEmail: email });
        return res.status(403).json({ message: 'Unauthorized access to user data' });
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ message: 'Invalid authentication token' });
    }

    // Get chat history count
    const chatHistoryCountQuery = await pool.query(
      'SELECT COUNT(*) as count FROM user_chat_history WHERE useremail = $1',
      [email]
    );
    const chatHistoryCount = parseInt(chatHistoryCountQuery.rows[0]?.count || '0');

    // Get last active date
    const lastActiveQuery = await pool.query(
      'SELECT MAX(date) as last_active FROM user_chat_history WHERE useremail = $1',
      [email]
    );
    const lastActive = lastActiveQuery.rows[0]?.last_active || null;

    // Get account creation date from Firebase
    let accountCreated = null;
    try {
      // Validate email format before attempting Firebase Auth
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.warn('Invalid email format provided to user-data-stats:', email);
      } else {
        const userRecord = await admin.auth().getUserByEmail(email);
        accountCreated = userRecord.metadata.creationTime;
      }
    } catch (error) {
      console.error('Error fetching user creation date:', error);
    }

    // Return the stats
    return res.status(200).json({
      chatHistoryCount,
      lastActive,
      accountCreated
    });
  } catch (error) {
    console.error('Error fetching user data stats:', error);
    return res.status(500).json({ message: 'Error processing the request' });
  }
}