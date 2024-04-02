import React, { ReactElement, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, reload } from 'firebase/auth';
import { auth } from 'utils/firebase';
import CustomLoginForm from './CustomLoginForm'; 
import { useRouter } from 'next/router';

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
  const router = useRouter(); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const shouldReload = sessionStorage.getItem('emailVerified') === 'true';
        if (shouldReload) {
          await reload(user);
          sessionStorage.removeItem('emailVerified'); // Remove the flag after reloading
        }
        setUserState({
          isAuthChecked: true,
          isLoading: false,
          isSignedIn: true,
          isEmailVerified: user.emailVerified,
        });
      } else {
        setUserState({
          isAuthChecked: true,
          isLoading: false,
          isSignedIn: false,
          isEmailVerified: false,
        });
      }
    });
  
    return () => unsubscribe(); // Cleanup the subscription
  }, []);

  if (userState.isLoading) return <div>Loading...</div>;
  if (!userState.isSignedIn) return <CustomLoginForm />;
  if (!userState.isEmailVerified) return <div>Please verify your email to access the content.</div>;

  return <>{children}</>;
};

export default AuthWrapper;
