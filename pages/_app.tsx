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
  const [isFromSolidcamWeb, setIsFromSolidcamWeb] = useState(false);

  const noAuthRequired = [
    '/verify-email',
    '/verification-sent',
    '/verification-failed',
    '/account-created-confirmation',
    '/password-reset-confirmation',
    '/acctmgmt',
    '/privacy-policy',
  ];

  useEffect(() => {
    const checkStaging = async () => {
      const queryParams = new URLSearchParams(window.location.search);
      const referrer = queryParams.get('referrer');
      console.log('Referrer:', referrer);

      const isFromSolidcamWeb = referrer === 'staging.solidcam.com';
      console.log('isFromSolidcamWeb:', isFromSolidcamWeb);

      if (isFromSolidcamWeb) {
        try {
          let webBrowserId = localStorage.getItem('webBrowserId');
          const isNewUser = !webBrowserId;

          if (!webBrowserId) {
            webBrowserId = uuidv4();
            localStorage.setItem('webBrowserId', webBrowserId);
          }

          const roomId = `room-${webBrowserId.slice(0, 10)}`;
          localStorage.setItem('roomId', roomId);

          setIsFromSolidcamWeb(true);

          // Safely track staging user
          try {
            trackSCwebsiteUser(webBrowserId, isNewUser);
          } catch (error) {
            console.error('Error tracking staging user:', error);
          }
        } catch (error) {
          console.error('Error in staging setup:', error);
          setIsFromSolidcamWeb(false);
        }
      }
    };

    checkStaging();

    try {
      setUserIdForAnalytics();
    } catch (error) {
      console.error('Error setting user ID for analytics:', error);
    }
  }, []);

  const isAuthRequired = !noAuthRequired.some((path) =>
    router.pathname.startsWith(path)
  ) && !isFromSolidcamWeb;

  // Pass `isFromSolidcamWeb` as a prop to the Component
  const enhancedProps = {
    ...pageProps,
    isFromSolidcamWeb, // Add this line to ensure the prop is passed to all pages
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
