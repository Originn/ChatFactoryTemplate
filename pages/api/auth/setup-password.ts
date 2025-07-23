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
      
      // SMART DETECTION: Try to get the actual project ID from frontend config
      const frontendProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const backendProjectId = process.env.FIREBASE_PROJECT_ID;
      
      console.log('🔍 Project ID detection:', {
        frontendProjectId,
        backendProjectId,
        match: frontendProjectId === backendProjectId
      });
      
      // Use frontend project ID if backend doesn't match (deployment bug scenario)
      const actualProjectId = frontendProjectId || backendProjectId;
      
      // Try to construct the service account email for the actual project
      let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // If we detect a project mismatch, try to construct the correct service account
      if (frontendProjectId && frontendProjectId !== backendProjectId) {
        console.log('🔧 Detected project mismatch - attempting smart credential construction');
        
        // Common Firebase service account pattern: firebase-adminsdk-{random}@{project-id}.iam.gserviceaccount.com
        // But since we don't know the random part, we'll need to use a different approach
        
        console.log('⚠️ Project mismatch detected. Backend configured for:', backendProjectId);
        console.log('⚠️ Frontend uses:', frontendProjectId);
        console.log('⚠️ This indicates a deployment automation issue.');
        
        // For now, let's try to use the credentials as-is but log the mismatch
        // The proper fix would be updating the deployment system
      }

      console.log('🔍 Local Firebase credentials check:', {
        projectId: actualProjectId,
        clientEmail: clientEmail ? 'SET' : 'MISSING',
        privateKey: privateKey ? 'SET' : 'MISSING'
      });

      if (!actualProjectId || !clientEmail || !privateKey) {
        throw new Error('Missing local Firebase Admin credentials');
      }

      const credentials = {
        projectId: actualProjectId,
        clientEmail: clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      };

      localAdminInstance = admin.initializeApp({
        credential: admin.credential.cert(credentials),
      });
      
      console.log('✅ Local Firebase Admin initialized for project:', actualProjectId);
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
        privateKey: process.env.CHATFACTORY_MAIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY || '',
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

  const startTime = Date.now(); // 🔧 Track performance
  
  try {
    const { token, newPassword, email } = req.body;

    if (!token || !newPassword || !email) {
      return res.status(400).json({ error: 'Token, password, and email are required' });
    }

    console.log('🔧 Processing password setup for token:', token.substring(0, 10) + '...');
    console.log('🔧 Setting up password for email:', email);

    // STEP 1: Connect to main ChatFactory project database for token validation
    console.log('🔍 Step 1: Connecting to main ChatFactory project for token validation');
    
    // 🚀 OPTIMIZATION: Initialize both connections in parallel
    const [mainApp, localApp] = await Promise.all([
      Promise.resolve(getMainProjectAdmin()), // Wrapped in Promise.resolve for parallel execution
      Promise.resolve(getLocalFirebaseAdmin())
    ]);
    
    const mainDb = mainApp.firestore();
    const localAuth = localApp.auth();
    
    console.log(`⚡ Firebase connections established in ${Date.now() - startTime}ms`);

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
    console.log(`⚡ Token validation completed in ${Date.now() - startTime}ms`);

    // STEP 2: Update the user's password in the LOCAL dedicated project
    console.log('🔍 Step 2: Updating password in local/dedicated project');
    
    try {
      console.log('🔍 Looking for user in local project with email:', email);
      
      // 🚀 OPTIMIZATION: Try to get user directly, handle error if not found
      let userRecord;
      try {
        userRecord = await localAuth.getUserByEmail(email);
        console.log('✅ User found in local project:', userRecord.uid);
        
        // 🚀 OPTIMIZATION: Update existing user (most common case)
        console.log('🔧 Updating password for existing user...');
        await localAuth.updateUser(userRecord.uid, {
          password: newPassword,
          emailVerified: true // 🔧 FIX: Always mark email as verified for admin-managed users
        });

        console.log('✅ Password updated successfully for user in local project:', userRecord.uid);
        console.log('✅ Email verification status set to true');
        console.log(`⚡ Total processing time: ${Date.now() - startTime}ms`);

        return res.status(200).json({
          success: true,
          message: 'Password updated successfully'
        });
        
      } catch (getUserError: any) {
        console.log('⚠️ User not found in local project, error:', getUserError.code);
        
        if (getUserError.code === 'auth/user-not-found') {
          // 🚀 OPTIMIZATION: Create user only if not found (less common case)
          console.log('🔧 Creating user in local project...');
          try {
            userRecord = await localAuth.createUser({
              email: email,
              password: newPassword,
              emailVerified: true // Since they came from email verification
            });
            console.log('✅ User created in local project:', userRecord.uid);
            console.log(`⚡ Total processing time: ${Date.now() - startTime}ms`);
            
            return res.status(200).json({
              success: true,
              message: 'User created and password set successfully'
            });
          } catch (createError: any) {
            console.error('❌ Error creating user in local project:', createError);
            return res.status(500).json({ error: 'Failed to create user account' });
          }
        } else if (getUserError.code === 'auth/insufficient-permission') {
          console.error('❌ DEPLOYMENT BUG: Insufficient permissions for local project');
          console.error('This indicates the deployment system did not configure the correct Firebase credentials');
          console.error('Expected project:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
          console.error('Configured for:', process.env.FIREBASE_PROJECT_ID);
          
          return res.status(500).json({ 
            error: 'Deployment configuration error: Firebase credentials mismatch. Please check deployment automation.' 
          });
        } else {
          throw getUserError; // Re-throw if it's a different error
        }
      }

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
      } else if (updateError.code === 'auth/insufficient-permission') {
        return res.status(500).json({ 
          error: 'Deployment configuration error: Firebase credentials have insufficient permissions for the target project.' 
        });
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
