// pages/api/delete-account.ts

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
    const { email, uid } = req.body;

    if (!email || !uid) {
      return res.status(400).json({ message: 'Email and UID are required' });
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
      if (decodedToken.email !== email || decodedToken.uid !== uid) {
        return res.status(403).json({ message: 'Unauthorized access' });
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ message: 'Invalid authentication' });
    }

    // Start a transaction to ensure all data is processed atomically
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete chat history
      await client.query('DELETE FROM user_chat_history WHERE useremail = $1', [email]);
      
      // Anonymize Q&A history instead of deleting it
      await client.query(`
        UPDATE QuestionsAndAnswers 
        SET userEmail = 'anon-' || SUBSTR(MD5(userEmail), 1, 8),
            question = REGEXP_REPLACE(question, '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b', '[EMAIL REDACTED]'),
            question = REGEXP_REPLACE(question, '\\b\\d{10,16}\\b', '[NUMBER REDACTED]'),
            question = REGEXP_REPLACE(question, '\\b\\d{3}[- ]?\\d{2}[- ]?\\d{4}\\b', '[SSN REDACTED]')
        WHERE userEmail = $1
      `, [email]);
      
      // Delete privacy settings
      await client.query('DELETE FROM user_privacy_settings WHERE email = $1', [email]);
      
      // Delete question embedder history
      await client.query('DELETE FROM "QuestionEmbedder" WHERE email = $1', [email]);
      
      // Log the deletion for compliance purposes
      await client.query(
        'INSERT INTO gdpr_deletion_log (email, deletion_date, requested_by) VALUES ($1, NOW(), $2)',
        [email, uid]
      );
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Delete the user from Firebase Authentication
    try {
      await admin.auth().deleteUser(uid);
    } catch (firebaseError) {
      console.error('Error deleting Firebase user:', firebaseError);
      return res.status(500).json({ 
        message: 'Database data deleted, but error deleting Firebase account. Please contact support.' 
      });
    }

    return res.status(200).json({ message: 'Account successfully deleted' });
  } catch (error) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ message: 'Error processing the request' });
  }
}