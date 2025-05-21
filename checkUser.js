const admin = require('firebase-admin');

// Initialize Firebase Admin using GOOGLE_APPLICATION_CREDENTIALS
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
} else {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.');
}

// Function to fetch and display user details
async function checkUserState(uid) {
  try {
    const userRecord = await admin.auth().getUser(uid);
  } catch (error) {
    console.error('Error fetching user data:', error);
  }
}

// Read user UID from the command line arguments
const userUid = process.argv[2];

// Call the function with the provided UID
checkUserState(userUid);
