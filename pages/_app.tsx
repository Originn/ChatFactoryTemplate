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

// In _app.tsx where we set up the staging user
useEffect(() => {
  const checkStaging = async () => {
    const referrer = document.referrer;
    const isStaging = referrer.includes('staging.solidcam.com');
    
    if (isStaging) {
      try {
        // Generate or get staging browser ID
        let stagingBrowserId = localStorage.getItem('stagingBrowserId');
        const isNewUser = !stagingBrowserId;
        
        if (!stagingBrowserId) {
          stagingBrowserId = uuidv4();
          localStorage.setItem('stagingBrowserId', stagingBrowserId);
        }

        // Create room ID without duplicate "staging-" prefix
        // Just use the first 8 characters of the UUID for the room ID
        const roomId = `staging-${stagingBrowserId.slice(0, 8)}`;
        localStorage.setItem('roomId', roomId);
        
        setIsFromStaging(true);

        // Track the staging user
        trackStagingUser(stagingBrowserId, isNewUser);

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