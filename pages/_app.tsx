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

const STAGING_ID_KEY = 'stagingBrowserId';
const ROOM_ID_KEY = 'roomId';

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
          // First, ensure we have a unique browser ID for this staging user
          let browserStagingId = localStorage.getItem(STAGING_ID_KEY);
          const isNewUser = !browserStagingId;
          
          if (!browserStagingId) {
            browserStagingId = `staging-${uuidv4()}`;
            localStorage.setItem(STAGING_ID_KEY, browserStagingId);
          }

          // Sign in anonymously - this might return an existing or new anonymous user
          const userCredential = await signInAnonymously(auth);
          
          // Combine Firebase UID with browser staging ID for the room
          const roomId = `room-${browserStagingId.slice(0, 8)}`;
          localStorage.setItem(ROOM_ID_KEY, roomId);
          
          setIsFromStaging(true);

          // Track the staging user using the browser staging ID
          trackStagingUser(browserStagingId, isNewUser);

          if (process.env.NODE_ENV === 'development') {
            console.log('Browser Staging ID:', browserStagingId);
            console.log('Firebase UID:', userCredential.user.uid);
            console.log('Room ID:', roomId);
            console.log('User type:', isNewUser ? 'New User' : 'Returning User');
          }

        } catch (error) {
          console.error('Error in staging setup:', error);
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