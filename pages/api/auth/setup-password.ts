import { NextApiRequest, NextApiResponse } from 'next';

// Types for Firebase Admin
interface MainProjectCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

// Initialize LOCAL Firebase Admin (this chatbot's project)
let localAdminInstance: any = null;

const getLocalFirebaseAdmin = () => {
  if (localAdminInstance) {
    return localAdminInstance;
  }

  try {
    const admin = require('firebase-admin');
    
    // Check if default app already exists
    try {
      localAdminInstance = admin.app();
      console.log('🔧 Using existing local Firebase Admin app');
      return localAdminInstance;
    } catch (error) {
      console.log('🔧 Initializing new local Firebase Admin app...');
      
      // Get LOCAL project credentials from environment
      const localProjectId = process.env.FIREBASE_PROJECT_ID;
      const localClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const localPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

      console.log('🔍 Local Firebase credentials check:', {
        projectId: localProjectId,
        clientEmail: localClientEmail ? 'SET' : 'MISSING',
        privateKey: localPrivateKey ? 'SET' : 'MISSING'
      });

      if (!localProjectId || !localClientEmail || !localPrivateKey) {
        throw new Error('Missing local Firebase Admin credentials');
      }

      const credentials = {
        projectId: localProjectId,
        clientEmail: localClientEmail,
        privateKey: localPrivateKey.replace(/\\n/g, '\n'),
      };

      localAdminInstance = admin.initializeApp({
        credential: admin.credential.cert(credentials),
      });
      
      console.log('✅ Local Firebase Admin initialized for project:', localProjectId);
      return localAdminInstance;
    }
  } catch (error) {
    console.error('❌ Failed to initialize local Firebase Admin:', error);
    throw error;
  }
};

// Initialize connection to MAIN ChatFactory project (where tokens are stored)
let mainAppInstance: any = null;

const getMainProjectAdmin = () => {
  const mainAppName = 'main-chatfactory';
  
  if (mainAppInstance) {
    return mainAppInstance;
  }

  try {
    const admin = require('firebase-admin');
    
    // Try to get existing app first
    try {
      mainAppInstance = admin.app(mainAppName);
      console.log('🔧 Using existing main Firebase Admin app');
      return mainAppInstance;
    } catch (error) {
      console.log('🔧 Initializing new main Firebase Admin app...');
      
      const credentials: MainProjectCredentials = {
        projectId: process.env.CHATFACTORY_MAIN_PROJECT_ID || 'docsai-chatbot-app',
        clientEmail: process.env.CHATFACTORY_MAIN_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@docsai-chatbot-app.iam.gserviceaccount.com',
        privateKey: process.env.CHATFACTORY_MAIN_PRIVATE_KEY || '',
      };

      console.log('🔍 Main Firebase credentials check:', {
        projectId: credentials.projectId,
        clientEmail: credentials.clientEmail ? 'SET' : 'MISSING',
        privateKey: credentials.privateKey ? 'SET' : 'MISSING'
      });

      mainAppInstance = admin.initializeApp({
        credential: admin.credential.cert(credentials),
      }, mainAppName);
      
      console.log('✅ Main Firebase Admin initialized for project:', credentials.projectId);
      return mainAppInstance;
    }
  } catch (error) {
    console.error('❌ Failed to initialize main Firebase Admin:', error);
    throw error;
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
    console.log('🔧 Setting up password for email:', email);

    // STEP 1: Connect to main ChatFactory project database for token validation
    console.log('🔍 Step 1: Connecting to main ChatFactory project for token validation');
    const mainApp = getMainProjectAdmin();
    const mainDb = mainApp.firestore();

    // Get token data to verify it's valid
    const tokenDoc = await mainDb
      .collection('passwordResetTokens')
      .doc(token)
      .get();

    if (!tokenDoc.exists) {
      console.log('❌ Token not found in main project');
      return res.status(400).json({ error: 'Invalid or expired setup link' });
    }

    const tokenData = tokenDoc.data();

    // Verify token is valid
    if (tokenData?.used || tokenData?.expiresAt?.toDate() < new Date()) {
      console.log('❌ Token is used or expired');
      return res.status(400).json({ error: 'Setup link has expired or already been used' });
    }

    if (tokenData?.email !== email) {
      console.log('❌ Email mismatch');
      return res.status(400).json({ error: 'Email mismatch' });
    }

    console.log('✅ Token validated in main project');

    // STEP 2: Update the user's password in the LOCAL dedicated project
    console.log('🔍 Step 2: Updating password in local/dedicated project');
    
    try {
      const localApp = getLocalFirebaseAdmin();
      const localAuth = localApp.auth();
      
      console.log('🔍 Looking for user in local project with email:', email);
      
      // Try to get the user first
      let userRecord;
      try {
        userRecord = await localAuth.getUserByEmail(email);
        console.log('✅ User found in local project:', userRecord.uid);
      } catch (getUserError: any) {
        console.log('⚠️ User not found in local project, error:', getUserError.code);
        
        if (getUserError.code === 'auth/user-not-found') {
          // User doesn't exist in local project - create them
          console.log('🔧 Creating user in local project...');
          try {
            userRecord = await localAuth.createUser({
              email: email,
              password: newPassword,
              emailVerified: true // Since they came from email verification
            });
            console.log('✅ User created in local project:', userRecord.uid);
            
            return res.status(200).json({
              success: true,
              message: 'User created and password set successfully'
            });
          } catch (createError: any) {
            console.error('❌ Error creating user in local project:', createError);
            return res.status(500).json({ error: 'Failed to create user account' });
          }
        } else {
          throw getUserError; // Re-throw if it's a different error
        }
      }
      
      // If we get here, user exists - update their password
      console.log('🔧 Updating password for existing user...');
      await localAuth.updateUser(userRecord.uid, {
        password: newPassword
      });

      console.log('✅ Password updated successfully for user in local project:', userRecord.uid);

      return res.status(200).json({
        success: true,
        message: 'Password updated successfully'
      });

    } catch (updateError: any) {
      console.error('❌ Error in local project operations:', updateError);
      console.error('Error code:', updateError.code);
      console.error('Error message:', updateError.message);
      
      if (updateError.code === 'auth/weak-password') {
        return res.status(400).json({ error: 'Password is too weak. Please choose a stronger password.' });
      } else if (updateError.code === 'auth/invalid-credential') {
        return res.status(500).json({ error: 'Invalid Firebase credentials for local project' });
      } else if (updateError.code === 'auth/project-not-found') {
        return res.status(500).json({ error: 'Local Firebase project not found' });
      }
      
      return res.status(500).json({ error: 'Failed to update password' });
    }

  } catch (error: any) {
    console.error('❌ Password setup API error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
