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
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    console.log('🔧 Marking token as used in main project:', token.substring(0, 10) + '...');

    // Connect to main ChatFactory project database
    const mainApp = getMainProjectAdmin();
    const mainDb = mainApp.firestore();

    // Mark token as used in main project Firestore
    await mainDb.collection('passwordResetTokens').doc(token).update({
      used: true,
      usedAt: new Date()
    });

    console.log('✅ Token marked as used in main project:', token.substring(0, 10) + '...');

    return res.status(200).json({
      success: true,
      message: 'Token marked as used'
    });

  } catch (error: any) {
    console.error('❌ Error marking token as used:', error);
    return res.status(500).json({ error: 'Failed to mark token as used' });
  }
}
