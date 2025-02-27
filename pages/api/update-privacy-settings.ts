// pages/api/update-privacy-settings.ts

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

interface PrivacySettings {
  allowAnalytics: boolean;
  storeHistory: boolean;
  retentionPeriod: string;
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
    const { uid, settings } = req.body as { uid: string; settings: PrivacySettings };

    if (!uid || !settings) {
      return res.status(400).json({ message: 'UID and settings are required' });
    }

    // Verify the user is authenticated
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    let userEmail: string;
    
    try {
      // Verify the token
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Check if the token belongs to the requested user
      if (decodedToken.uid !== uid) {
        return res.status(403).json({ message: 'Unauthorized access' });
      }
      
      userEmail = decodedToken.email || '';
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ message: 'Invalid authentication' });
    }

    // Validate settings
    const { allowAnalytics, storeHistory, retentionPeriod } = settings;
    
    if (typeof allowAnalytics !== 'boolean' || typeof storeHistory !== 'boolean') {
      return res.status(400).json({ message: 'Invalid settings format' });
    }
    
    // Validate retention period
    const validRetentionPeriods = ['forever', '1year', '6months', '3months', '1month'];
    if (!validRetentionPeriods.includes(retentionPeriod)) {
      return res.status(400).json({ message: 'Invalid retention period' });
    }

    // Update or insert privacy settings
    const upsertQuery = `
      INSERT INTO user_privacy_settings 
        (uid, email, allow_analytics, store_history, retention_period, updated_at)
      VALUES 
        ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (uid) 
      DO UPDATE SET
        email = $2,
        allow_analytics = $3,
        store_history = $4, 
        retention_period = $5,
        updated_at = NOW()
      RETURNING *;
    `;

    const result = await pool.query(upsertQuery, [
      uid,
      userEmail,
      allowAnalytics,
      storeHistory,
      retentionPeriod
    ]);

    // If user turned off history storage, optionally delete their history
    if (!storeHistory) {
      // This could be made optional or configurable
      await pool.query('DELETE FROM user_chat_history WHERE useremail = $1', [userEmail]);
    }

    // Apply retention period to existing data
    if (retentionPeriod !== 'forever') {
      let interval;
      
      switch (retentionPeriod) {
        case '1year':
          interval = '1 year';
          break;
        case '6months':
          interval = '6 months';
          break;
        case '3months':
          interval = '3 months';
          break;
        case '1month':
          interval = '1 month';
          break;
        default:
          interval = null;
      }
      
      if (interval) {
        // Delete chat history older than the specified interval
        await pool.query(
          'DELETE FROM user_chat_history WHERE useremail = $1 AND date < NOW() - INTERVAL $2',
          [userEmail, interval]
        );
      }
    }

    return res.status(200).json({ 
      message: 'Privacy settings updated successfully',
      settings: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    return res.status(500).json({ message: 'Error processing the request' });
  }
}