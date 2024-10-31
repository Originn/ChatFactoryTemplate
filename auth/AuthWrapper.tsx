import React, { ReactElement, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { auth } from 'utils/firebase';
import CustomLoginForm from './CustomLoginForm'; 
import Cookies from 'js-cookie';
import InitialDisclaimerModal from 'components/InitialDisclaimerModal';

interface AuthWrapperProps {
  children: ReactNode;
}

interface UserState {
  isLoading: boolean;
  isSignedIn: boolean;
  isEmailVerified: boolean;
  isAuthChecked: boolean; // Tracks if the initial check is done
}

const AuthWrapper = ({ children }: AuthWrapperProps): ReactElement | null => {
  const [userState, setUserState] = useState<UserState>({
    isLoading: true,
    isSignedIn: false,
    isEmailVerified: false,
    isAuthChecked: false
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tokenResult = await getIdTokenResult(user);
        const expiryTime = new Date(tokenResult.expirationTime).getTime();
        const currentTime = new Date().getTime();
        const timeLeft = expiryTime - currentTime;
  
        if (timeLeft < 5 * 60 * 1000) { // 5 minutes before expiration
          await user.getIdToken(true); // Refresh token
        }
  
        setUserState({
          isLoading: false,
          isSignedIn: true,
          isEmailVerified: user.emailVerified,
          isAuthChecked: true,
        });
      } else {
        setUserState({
          isLoading: false,
          isSignedIn: false,
          isEmailVerified: false,
          isAuthChecked: true,
        });
      }
    });
  
    // Set up interval to refresh token periodically
    const intervalId = setInterval(async () => {
      const user = auth.currentUser;
      if (user) {
        const tokenResult = await getIdTokenResult(user, true);
        Cookies.set('sessionToken', tokenResult.token, { expires: 1 });
      }
    }, 50 * 60 * 1000); // Every 50 minutes
  
    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, []);
  

  // Render the login form if the user is not signed in or if the email isn't verified
  if (userState.isLoading) {
    return <div></div>;
  } else if (!userState.isSignedIn || !userState.isEmailVerified) {
    return <CustomLoginForm />;
  } else {
    // If the user is signed in and the email is verified, render the children
    <InitialDisclaimerModal />
    return <>{children}</>;
  }
};

export default AuthWrapper;
