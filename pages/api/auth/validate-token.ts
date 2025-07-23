import { NextApiRequest, NextApiResponse } from 'next';
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
    const { token, chatbotId } = req.body;

    if (!token || !chatbotId) {
      return res.status(400).json({ error: 'Token and chatbot ID are required' });
    }

    console.log('🔧 Validating custom token:', token.substring(0, 10) + '...');
    console.log('🔍 Connecting to main ChatFactory project for token validation');

    // Connect to main ChatFactory project database
    const mainApp = getMainProjectAdmin();
    const mainDb = mainApp.firestore();

    // Get token data from main project Firestore
    const tokenDoc = await mainDb
      .collection('passwordResetTokens')
      .doc(token)
      .get();

    if (!tokenDoc.exists) {
      console.log('❌ Token not found in main project database');
      return res.status(400).json({ error: 'Invalid or expired setup link' });
    }

    const tokenData = tokenDoc.data();

    // Verify token is valid
    if (tokenData?.used) {
      return res.status(400).json({ error: 'This setup link has already been used' });
    }

    if (tokenData?.expiresAt?.toDate() < new Date()) {
      return res.status(400).json({ error: 'This setup link has expired' });
    }

    // Verify chatbot ID matches
    if (tokenData?.chatbotId !== chatbotId) {
      return res.status(400).json({ error: 'Invalid setup link for this chatbot' });
    }

    console.log('✅ Token validation successful in main project');

    return res.status(200).json({
      success: true,
      email: tokenData?.email,
      userId: tokenData?.userId
    });

  } catch (error: any) {
    console.error('❌ Token validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
