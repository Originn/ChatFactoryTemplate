import '@/styles/base.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import AuthWrapper from '../auth/AuthWrapper';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { setUserIdForAnalytics } from '@/utils/tracking';
import { v4 as uuidv4 } from 'uuid';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isFromSolidcamWeb, setIsFromSolidcamWeb] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const noAuthRequired = [
    '/verify-email',
    '/verification-sent',
    '/verification-failed',
    '/account-created-confirmation',
    '/password-reset-confirmation',
    '/acctmgmt',
    '/privacy-policy',
  ];

  // Load theme from localStorage on initial render
  useEffect(() => {
    // Apply the saved theme as early as possible
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
      if (savedTheme) {
        setTheme(savedTheme);
        // Apply theme class to document immediately
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(savedTheme);
        document.body.classList.remove('light', 'dark');
        document.body.classList.add(savedTheme);
      }
    }
  }, []);

  useEffect(() => {
    const checkStaging = async () => {
      let isFromSolidcamWeb = false;
      
      try {
        // Check if we're in an iframe
        const isInIframe = window !== window.parent;
        
        if (isInIframe) {
          // If we can access the parent, check its URL or origin
          // Note: This may fail due to same-origin policy if on different domains
          isFromSolidcamWeb = true;
        } else {
          // Fall back to referrer check
          const queryParams = new URLSearchParams(window.location.search);
          const referrer = queryParams.get('referrer') || document.referrer;
          isFromSolidcamWeb = referrer.includes('solidcam.com');
        }
      } catch (e) {
        // If we get a security error, assume we're in an iframe from solidcam.com
        console.error("Security error checking iframe status:", e);
        isFromSolidcamWeb = true;
      }
      
      //console.log('isFromSolidcamWeb:', isFromSolidcamWeb);
  
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
    initialTheme: theme, // Pass the initial theme to prevent flashing
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
      <div className={theme}>
        {isAuthRequired ? (
          <AuthWrapper>
            <Component {...enhancedProps} />
          </AuthWrapper>
        ) : (
          <Component {...enhancedProps} />
        )}
      </div>
    </>
  );
}

export default MyApp;