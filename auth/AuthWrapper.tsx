//auth/AuthWrapper.tsx
import React, { useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User, applyActionCode } from 'firebase/auth';
import { auth } from 'utils/firebase';

interface AuthWrapperProps {
  children: ReactNode;
  showAuthUI?: boolean;
  bypassAuth?: boolean;
}

interface UserState {
  isLoading: boolean;
  isSignedIn: boolean;
  isEmailVerified: boolean;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children, showAuthUI = true, bypassAuth = false }) => {
  const [userState, setUserState] = useState<UserState>({
    isLoading: true,
    isSignedIn: false,
    isEmailVerified: false,
  });
  const [FirebaseAuthUI, setFirebaseAuthUI] = useState<ReactNode | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserState({
          isLoading: false,
          isSignedIn: true,
          isEmailVerified: user.emailVerified,
        });
      } else {
        setUserState({
          isLoading: false,
          isSignedIn: false,
          isEmailVerified: false,
        });
      }
    });

    if (showAuthUI) {
      import('./FirebaseAuthUI').then(({ default: FirebaseAuthUI }) => {
        setFirebaseAuthUI(<FirebaseAuthUI />);
      });
    }

    return () => unsubscribe();
  }, [showAuthUI]);

  useEffect(() => {
    const handleEmailVerification = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      const oobCode = urlParams.get('oobCode');

      if (mode === 'verifyEmail' && oobCode) {
        try {
          await applyActionCode(auth, oobCode);
        } catch (error) {
          console.error('Error verifying email:', error);
        }
      }
    };

    handleEmailVerification();
  }, []);

  if (userState.isLoading) {
    return <div>Loading...</div>;
  }

  if (bypassAuth) {
    return <>{children}</>;
  }

  if (!userState.isSignedIn) {
    return showAuthUI ? FirebaseAuthUI || <div>Loading...</div> : <div>Please sign in.</div>;
  }

  if (!userState.isEmailVerified) {
    return <div>Please verify your email to access the content.</div>;
  }

  return <>{children}</>;
};

export default AuthWrapper;
