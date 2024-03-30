import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

// Your Firebase configuration object from your Firebase project settings
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth and set persistence
const auth = getAuth(app);

// Set the session persistence to Local
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    // Persistence is set to Local. Future sign-in requests will keep users logged in across sessions.
  })
  .catch((error) => {
    // Handle errors
    console.error("Error setting persistence:", error);
  });

export { auth };
