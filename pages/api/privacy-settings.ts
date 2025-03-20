// pages/api/privacy-settings.ts

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
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { uid } = req.query;

    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ message: 'UID parameter is required' });
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
      if (decodedToken.uid !== uid) {
        return res.status(403).json({ message: 'Unauthorized access to user data' });
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ message: 'Invalid authentication' });
    }

    // Query the database for privacy settings
    const query = 'SELECT * FROM user_privacy_settings WHERE uid = $1';
    const result = await pool.query(query, [uid]);

    // If no settings found, return default settings
    if (result.rows.length === 0) {
      return res.status(200).json({
        allowAnalytics: true,
        storeHistory: true,
        retentionPeriod: 'forever',
        aiProvider: 'openai'  // Default AI provider
      });
    }

    // Map database column names to camelCase for frontend
    const settings = result.rows[0];
    return res.status(200).json({
      allowAnalytics: settings.allow_analytics,
      storeHistory: settings.store_history,
      retentionPeriod: settings.retention_period,
      aiProvider: settings.ai_provider
    });
  } catch (error) {
    console.error('Error fetching privacy settings:', error);
    return res.status(500).json({ message: 'Error processing the request' });
  }
}