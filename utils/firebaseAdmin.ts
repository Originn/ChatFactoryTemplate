// utils/firebaseAdmin.ts
import admin from 'firebase-admin';

// Prevent re-initialization in serverless environments
if (!admin.apps.length) {
  try {
    // Check for required environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('Firebase Admin SDK environment variables not set:');
      console.warn('- FIREBASE_PROJECT_ID:', projectId ? 'SET' : 'MISSING');
      console.warn('- FIREBASE_CLIENT_EMAIL:', clientEmail ? 'SET' : 'MISSING');
      console.warn('- FIREBASE_PRIVATE_KEY:', privateKey ? 'SET' : 'MISSING');
      throw new Error('Missing required Firebase Admin environment variables');
    }

    // Initialize Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`,
    });

    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    throw error;
  }
}

// Export admin services
export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export const adminStorage = admin.storage();

export default admin;
