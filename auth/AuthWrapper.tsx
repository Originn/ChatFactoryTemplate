import React, { ReactElement, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from 'utils/firebase';
import CustomLoginForm from './CustomLoginForm'; 

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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserState(prevState => ({
        ...prevState,
        isAuthChecked: true,
        isLoading: false,
        isSignedIn: !!user,
        isEmailVerified: !!user && user.emailVerified,
      }));
    });
    
    return () => unsubscribe();
  }, []);

  // Render the login form if the user is not signed in or if the email isn't verified
  if (userState.isLoading) {
    return <div></div>;
  } else if (!userState.isSignedIn || !userState.isEmailVerified) {
    return <CustomLoginForm />;
  } else {
    // If the user is signed in and the email is verified, render the children
    return <>{children}</>;
  }
};

export default AuthWrapper;
