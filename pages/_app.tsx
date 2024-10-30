import '@/styles/base.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import AuthWrapper from '../auth/AuthWrapper';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { setUserIdForAnalytics, trackStagingUser } from '@/utils/tracking';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/utils/firebase';
import { v4 as uuidv4 } from 'uuid';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isFromStaging, setIsFromStaging] = useState(false);

  const noAuthRequired = [
    '/verify-email',
    '/verification-sent',
    '/verification-failed',
    '/account-created-confirmation',
    '/password-reset-confirmation',
    '/acctmgmt',
    '/privacy-policy'
  ];

  useEffect(() => {
    const checkStaging = async () => {
      const referrer = document.referrer;
      const isStaging = referrer.includes('staging.solidcam.com');
      
      if (isStaging) {
        try {
          // Sign in anonymously if from staging
          await signInAnonymously(auth);
          
          // Check for existing staging UUID in localStorage
          let stagingUUID = localStorage.getItem('stagingUUID');
          const isNewUser = !stagingUUID;
          
          if (!stagingUUID) {
            // Generate new UUID only if one doesn't exist
            stagingUUID = uuidv4();
            localStorage.setItem('stagingUUID', stagingUUID);
          }
          
          // Set room ID based on the UUID
          const roomId = `room-${stagingUUID.slice(0, 8)}`;
          localStorage.setItem('roomId', roomId);
          
          setIsFromStaging(true);

          // Track the staging user
          trackStagingUser(stagingUUID, isNewUser);

        } catch (error) {
          console.error('Error in anonymous sign-in:', error);
          setIsFromStaging(false);
        }
      }
    };

    checkStaging();
    setUserIdForAnalytics();
  }, []);

  const isAuthRequired = !noAuthRequired.some(path => 
    router.pathname.startsWith(path)
  ) && !isFromStaging;

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta 
          name="description" 
          content="Visit our website to further your knowledge about SolidCAM using our LLM ChatBot. Get personalized assistance and detailed information to enhance your experience." 
        />
        <title>SolidCAM Chat</title>
      </Head>
      {isAuthRequired ? (
        <AuthWrapper>
          <Component {...pageProps} />
        </AuthWrapper>
      ) : (
        <Component {...pageProps} />
      )}
    </>
  );
}

export default MyApp;