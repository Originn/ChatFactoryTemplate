import { AppProps } from 'next/app';
import AuthWrapper from '../auth/AuthWrapper';
import { useRouter } from 'next/router';
import Head from 'next/head';

import { useEffect, useMemo } from 'react';
import { CacheProvider, EmotionCache } from '@emotion/react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { getMuiTheme } from '@/utils/muiTheme';
import { setUserIdForAnalytics } from '@/utils/tracking';
import useTheme, { ThemeProvider as AppThemeProvider } from '@/hooks/useTheme';
import { getTemplateConfig } from '../config/template';
import createEmotionCache from '../utils/createEmotionCache';

// Import custom styles
import '@/styles/accordion-override.css';
import '@/styles/chat-container.css';
import '@/styles/settings-page.css';
import '@/styles/dark-mode.css';

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();

interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
}

function MyApp(props: MyAppProps) {
  const { Component, emotionCache = clientSideEmotionCache, pageProps } = props;
  
  // Fallback: If emotion cache causes issues, use without it
  const useEmotionCache = process.env.NODE_ENV !== 'production' || true; // Enable for now
  
  if (useEmotionCache) {
    return (
      <CacheProvider value={emotionCache}>
        <AppThemeProvider>
          <AppContent Component={Component} pageProps={pageProps} />
        </AppThemeProvider>
      </CacheProvider>
    );
  } else {
    // Fallback without emotion cache
    return (
      <AppThemeProvider>
        <AppContent Component={Component} pageProps={pageProps} />
      </AppThemeProvider>
    );
  }
}

function AppContent({ Component, pageProps }: { Component: AppProps['Component']; pageProps: AppProps['pageProps'] }) {
  const router = useRouter();
  const { theme } = useTheme();
  const config = getTemplateConfig();

  const noAuthRequired = [
    '/verify-email',
    '/verification-sent',
    '/verification-failed',
    '/account-created-confirmation',
    '/password-reset-confirmation',
    '/acctmgmt',
    '/privacy-policy',
    '/email-verification',
  ];

  // Add effect to disable body scrolling on the home page
  useEffect(() => {
    // Check if we're on the home page (index)
    const isHomePage = router.pathname === '/';
    
    if (isHomePage) {
      // Disable scrolling on the body
      document.body.style.overflow = 'hidden';
    } else {
      // Enable scrolling on other pages
      document.body.style.overflow = 'auto';
    }
    
    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [router.pathname]);

  useEffect(() => {
    try {
      setUserIdForAnalytics();
    } catch (error) {
      console.error('Error setting user ID for analytics:', error);
    }
  }, []);

  const chatbotLoginRequired =
    process.env.NEXT_PUBLIC_CHATBOT_LOGIN_REQUIRED === 'true';
  const isAuthRequired =
    chatbotLoginRequired &&
    !noAuthRequired.some((path) => router.pathname.startsWith(path));

  const muiTheme = useMemo(() => {
    const generatedTheme = getMuiTheme(theme as 'light' | 'dark');
    return generatedTheme;
  }, [theme]);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content={`Visit our website to further your knowledge about ${config.productName} using our LLM ChatBot. Get personalized assistance and detailed information to enhance your experience.`}
        />
        <title>{`${config.productName} Chat`}</title>
      </Head>
      
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />

        {isAuthRequired ? (
          <AuthWrapper>
            <Component {...pageProps} />
          </AuthWrapper>
        ) : (
          <Component {...pageProps} />
        )}

      </MuiThemeProvider>
    </>
  );
}

export default MyApp;
