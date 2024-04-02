// auth/AuthWrapper.tsx
import React, { ReactElement, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, applyActionCode } from 'firebase/auth';
import { auth } from 'utils/firebase';
import CustomLoginForm from './CustomLoginForm'; 
import { useRouter } from 'next/router';

interface AuthWrapperProps {
  children: ReactNode;
  bypassAuth?: boolean;
}

interface UserState {
  isLoading: boolean;
  isSignedIn: boolean;
  isEmailVerified: boolean;
  isAuthChecked: boolean; // Track if initial check is done
}

const AuthWrapper = ({
  children,
  bypassAuth = false,
}: AuthWrapperProps): ReactElement | null => {
  const [userState, setUserState] = useState<UserState>({
    isLoading: true,
    isSignedIn: false,
    isEmailVerified: false,
    isAuthChecked: false
  });

  const router = useRouter(); 

  useEffect(() => {
    const checkLocalStorage = () => {
      // Placeholder for your logic to check if user is logged in
      // Make sure this logic returns a boolean value.
      const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
      setUserState((prevState) => ({
        ...prevState,
        isAuthChecked: true,
        isLoading: false,
        isSignedIn: isLoggedIn,
        isEmailVerified: isLoggedIn ? true : false // Adjust based on your logic
      }));
    };
  
    checkLocalStorage(); 
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUserState({
        isAuthChecked: true, 
        isLoading: false,
        isSignedIn: !!user,
        isEmailVerified: user ? user.emailVerified : false,
      });
    });
    
    return () => unsubscribe();
  }, []);
  

  useEffect(() => {
  const handleEmailVerification = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');
    const continueUrl = urlParams.get('continueUrl'); // You can pass this as a query param in your email template

    if (mode === 'verifyEmail' && oobCode) {
      try {
        await applyActionCode(auth, oobCode);
        alert('Your email has been verified, you are being redirected...');
        // Redirect the user to dashboard or root of the app
        router.push(continueUrl || '/'); // Replace '/dashboard' with your dashboard route
      } catch (error) {
        console.error('Error verifying email:', error);
        // Handle error, possibly update UI to inform user
      }
    }
  };

  handleEmailVerification();
}, [router]);


  if (userState.isLoading) return <div>Loading...</div>;
  if (bypassAuth) return <>{children}</>;
  if (!userState.isSignedIn) return <CustomLoginForm />; // Render your custom login form
  if (!userState.isEmailVerified) return <div>Please verify your email to access the content.</div>;

  return <>{children}</>;
};

export default AuthWrapper;
