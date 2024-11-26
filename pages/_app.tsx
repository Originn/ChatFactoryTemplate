import '@/styles/base.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import AuthWrapper from '../auth/AuthWrapper';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { setUserIdForAnalytics, trackSCwebsiteUser } from '@/utils/tracking';
import { v4 as uuidv4 } from 'uuid';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isFromSolidcamWeb, setisFromSolidcamWeb] = useState(false);

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
      const isFromSolidcamWeb = /^(https?:\/\/)?(www\.|staging\.)solidcam\.com/.test(referrer);
      
      if (isFromSolidcamWeb) {
        try {
          // Generate or get staging browser ID
          let webBrowserId = localStorage.getItem('webBrowserId');
          const isNewUser = !webBrowserId;
          
          if (!webBrowserId) {
            webBrowserId = uuidv4();
            localStorage.setItem('webBrowserId', webBrowserId);
          }

          const roomId = `room-${webBrowserId.slice(0, 10)}`;
          localStorage.setItem('roomId', roomId);
          
          setisFromSolidcamWeb(true);

          // Track the staging user
          trackSCwebsiteUser(webBrowserId, isNewUser);

        } catch (error) {
          console.error('Error in staging setup:', error);
          setisFromSolidcamWeb(false);
        }
      }
    };

    checkStaging();
    setUserIdForAnalytics();
  }, []);

  const isAuthRequired = !noAuthRequired.some(path => 
    router.pathname.startsWith(path)
  ) && !isFromSolidcamWeb;

  // Combine the existing pageProps with our new prop
  const enhancedProps = {
    ...pageProps,
    isFromSolidcamWeb
  };

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
          <Component {...enhancedProps} />
        </AuthWrapper>
      ) : (
        <Component {...enhancedProps} />
      )}
    </>
  );
}

export default MyApp;