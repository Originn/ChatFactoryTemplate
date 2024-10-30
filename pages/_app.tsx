import '@/styles/base.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import AuthWrapper from '../auth/AuthWrapper';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { setUserIdForAnalytics } from '@/utils/tracking';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/utils/firebase';

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
      // Check if the referrer is from staging.solidcam.com
      const referrer = document.referrer;
      const isStaging = referrer.includes('staging.solidcam.com');
      
      if (isStaging) {
        try {
          // Sign in anonymously if from staging
          await signInAnonymously(auth);
          
          // Generate a consistent roomId based on browser fingerprint
          const browserFingerprint = `${navigator.userAgent}_${navigator.language}_${window.screen.width}x${window.screen.height}`;
          const roomId = `room-${btoa(browserFingerprint).slice(0, 8)}`;
          
          // Store roomId in localStorage
          localStorage.setItem('roomId', roomId);
          
          setIsFromStaging(true);
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
  ) && !isFromStaging; // Add isFromStaging check

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