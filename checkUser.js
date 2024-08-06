const admin = require('firebase-admin');

// Initialize Firebase Admin with your service account
const serviceAccount = require('./solidcamchat-firebase-adminsdk-6c5fy-fcfed248c9.json');  // Ensure the path is correct

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Optionally, specify your project ID here:
    // databaseURL: 'https://your-project-id.firebaseio.com'
  });

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
