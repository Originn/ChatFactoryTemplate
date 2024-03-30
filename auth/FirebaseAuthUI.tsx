// auth/FirebaseAuthUI.tsx
import React, { useEffect } from 'react';
import { EmailAuthProvider, GoogleAuthProvider, GithubAuthProvider, sendEmailVerification, getAuth } from 'firebase/auth';
import * as firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';
import { auth } from 'utils/firebase';
import { useRouter } from 'next/router';


const FirebaseAuthUI = () => {
  const router = useRouter();
  useEffect(() => {
    // Initialize the FirebaseUI Widget using Firebase.
    const ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(auth);

    const uiConfig = {
        signInOptions: [
          GoogleAuthProvider.PROVIDER_ID,
          GithubAuthProvider.PROVIDER_ID,
          'microsoft.com',
          {
            provider: EmailAuthProvider.PROVIDER_ID,
            requireDisplayName: false,
          },
          // Add other providers you want to support
        ],
        signInFlow: 'popup', // or 'redirect'
        callbacks: {
          signInSuccessWithAuthResult: (authResult : any, redirectUrl : any) => {
            // User successfully signed in or signed up.
            const user = authResult.user;
            
            if (user && !user.emailVerified) {
              // Newly created user or existing user that hasn't verified their email
              sendEmailVerification(user).then(() => {
                // Redirect to the email verification prompt page (React Router example)
                router.push('/verify-email'); // Replace with your actual route
              }).catch((error) => {
                console.error('Error sending email verification', error);
              });
          
              // Sign out the user until they verify their email
              auth.signOut();
          
              // Prevent automatic redirect by FirebaseUI
              return false;
            } else {
              // User is either already signed in or their email is verified.
              // You can redirect the user to your home page or dashboard here if needed.
            }
            
            return !!redirectUrl;
          },
          signInFailure: (error : any) => {
            // Handle the error here, such as displaying a notification to the user
            console.error(error);
            // Correctly return a promise of void type
            return Promise.resolve();
          },
        },
      };

    // The start method will wait until the DOM is loaded.
    ui.start('#firebaseui-auth-container', uiConfig);

    // Cleanup function
    return () => {
      ui.reset();
    };
  }, []);

  return <div id="firebaseui-auth-container" className="firebaseui-container-wrapper"></div>;
};

export default FirebaseAuthUI;
