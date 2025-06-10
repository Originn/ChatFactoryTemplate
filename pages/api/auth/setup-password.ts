import { NextApiRequest, NextApiResponse } from 'next';
import { adminDb, adminAuth } from '../../../utils/firebaseAdmin';
import admin from 'firebase-admin';

// Initialize connection to MAIN ChatFactory project (where tokens are stored)
const getMainProjectAdmin = () => {
  const mainAppName = 'main-chatfactory';
  
  try {
    return admin.app(mainAppName);
  } catch (error) {
    // Initialize connection to main project
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.CHATFACTORY_MAIN_PROJECT_ID || 'docsai-chatbot-app',
        clientEmail: process.env.CHATFACTORY_MAIN_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@docsai-chatbot-app.iam.gserviceaccount.com',
        privateKey: process.env.CHATFACTORY_MAIN_PRIVATE_KEY,
      }),
    }, mainAppName);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, newPassword, email } = req.body;

    if (!token || !newPassword || !email) {
      return res.status(400).json({ error: 'Token, password, and email are required' });
    }

    console.log('🔧 Processing password setup for token:', token.substring(0, 10) + '...');
    console.log('🔍 Connecting to main ChatFactory project for token validation');

    // Connect to main ChatFactory project database for token validation
    const mainApp = getMainProjectAdmin();
    const mainDb = mainApp.firestore();

    // Get token data to verify it's valid
    const tokenDoc = await mainDb
      .collection('passwordResetTokens')
      .doc(token)
      .get();

    if (!tokenDoc.exists) {
      return res.status(400).json({ error: 'Invalid or expired setup link' });
    }

    const tokenData = tokenDoc.data();

    // Verify token is valid
    if (tokenData?.used || tokenData?.expiresAt?.toDate() < new Date()) {
      return res.status(400).json({ error: 'Setup link has expired or already been used' });
    }

    if (tokenData?.email !== email) {
      return res.status(400).json({ error: 'Email mismatch' });
    }

    console.log('✅ Token validated in main project, now updating password in local project');

    // Update the user's password in the LOCAL dedicated project (this chatbot's Firebase Auth)
    try {
      const userRecord = await adminAuth.getUserByEmail(email);
      
      await adminAuth.updateUser(userRecord.uid, {
        password: newPassword
      });

      console.log('✅ Password updated successfully for user in local project:', userRecord.uid);

      return res.status(200).json({
        success: true,
        message: 'Password updated successfully'
      });

    } catch (updateError: any) {
      console.error('❌ Error updating password:', updateError);
      
      if (updateError.code === 'auth/user-not-found') {
        return res.status(404).json({ error: 'User account not found' });
      } else if (updateError.code === 'auth/weak-password') {
        return res.status(400).json({ error: 'Password is too weak. Please choose a stronger password.' });
      }
      
      return res.status(500).json({ error: 'Failed to update password' });
    }

  } catch (error: any) {
    console.error('❌ Password setup API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
