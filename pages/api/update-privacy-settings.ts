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
  storeHistory: boolean;
  retentionPeriod: string;
  aiProvider?: string;
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
    const { storeHistory, retentionPeriod, aiProvider } = settings;
    
    if (typeof storeHistory !== 'boolean') {
      return res.status(400).json({ message: 'Invalid settings format' });
    }
    
    // Validate retention period
    const validRetentionPeriods = ['forever', '1year', '6months', '3months', '1month'];
    if (!validRetentionPeriods.includes(retentionPeriod)) {
      return res.status(400).json({ message: 'Invalid retention period' });
    }

    // Validate AI provider if set
    if (aiProvider !== undefined) {
      const validProviders = ['openai', 'deepseek'];
      if (!validProviders.includes(aiProvider)) {
        return res.status(400).json({ message: 'Invalid AI provider' });
      }
    }

    // Start a database transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current settings to detect changes
      const currentSettingsQuery = 'SELECT * FROM user_privacy_settings WHERE uid = $1';
      const currentSettingsResult = await client.query(currentSettingsQuery, [uid]);
      const currentSettings = currentSettingsResult.rows[0] || null;
      
      // Update or insert privacy settings
      const upsertQuery = `
        INSERT INTO user_privacy_settings 
          (uid, email, store_history, retention_period, ai_provider, updated_at)
        VALUES 
          ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (uid) 
        DO UPDATE SET
          email = $2,
          store_history = $3, 
          retention_period = $4,
          ai_provider = $5,
          updated_at = NOW()
        RETURNING *;
      `;

      const result = await client.query(upsertQuery, [
        uid,
        userEmail,
        storeHistory,
        retentionPeriod,
        aiProvider || 'openai' // Default to 'openai' if not provided
      ]);

      // If user turned off history storage, delete their history
      if (!storeHistory) {
        await client.query('DELETE FROM user_chat_history WHERE useremail = $1', [userEmail]);
      }

      // Apply retention period to existing data
      // First, determine the SQL interval based on the retention period
      let sqlInterval = '';
      switch (retentionPeriod) {
        case '1year':
          sqlInterval = '1 year';
          break;
        case '6months':
          sqlInterval = '6 months';
          break;
        case '3months':
          sqlInterval = '3 months';
          break;
        case '1month':
          sqlInterval = '1 month';
          break;
        case 'forever':
          // No interval needed for 'forever'
          break;
      }
      
      // If retention period is not 'forever', apply it to data
      if (retentionPeriod !== 'forever') {
        // Delete chat history older than the retention period
        await client.query(
          `DELETE FROM user_chat_history 
           WHERE useremail = $1 AND date < NOW() - INTERVAL '${sqlInterval}'`,
          [userEmail]
        );
        
        // Anonymize Q&A data older than the retention period
        // FIXED: Changed multiple SET statements to nested REGEXP_REPLACE calls
        await client.query(
          `UPDATE QuestionsAndAnswers 
           SET userEmail = 'anon-' || SUBSTR(MD5(userEmail), 1, 8),
               question = REGEXP_REPLACE(
                 REGEXP_REPLACE(
                   REGEXP_REPLACE(
                     question, 
                     '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b', 
                     '[EMAIL REDACTED]'
                   ),
                   '\\b\\d{10,16}\\b', 
                   '[NUMBER REDACTED]'
                 ),
                 '\\b\\d{3}[- ]?\\d{2}[- ]?\\d{4}\\b', 
                 '[SSN REDACTED]'
               )
           WHERE userEmail = $1 AND created_at < NOW() - INTERVAL '${sqlInterval}'`,
          [userEmail]
        );
      }
      
      await client.query('COMMIT');
      
      return res.status(200).json({ 
        message: 'Privacy settings updated successfully',
        settings: {
          storeHistory: result.rows[0].store_history,
          retentionPeriod: result.rows[0].retention_period,
          aiProvider: result.rows[0].ai_provider
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    return res.status(500).json({ message: 'Error processing the request' });
  }
}