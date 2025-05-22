import type { AppProps } from 'next/app';
import AuthWrapper from '../auth/AuthWrapper';
import { useRouter } from 'next/router';
import Head from 'next/head';

import { useEffect, useMemo } from 'react';

import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { getMuiTheme } from '@/utils/muiTheme';
import { setUserIdForAnalytics } from '@/utils/tracking';
import useTheme, { ThemeProvider as AppThemeProvider } from '@/hooks/useTheme';

// Import custom styles
import '@/styles/accordion-override.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AppThemeProvider>
      <AppContent Component={Component} pageProps={pageProps} />
    </AppThemeProvider>
  );
}

function AppContent({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { theme } = useTheme();

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
    try {
      setUserIdForAnalytics();
    } catch (error) {
      console.error('Error setting user ID for analytics:', error);
    }
  }, []);

  const isAuthRequired = !noAuthRequired.some((path) =>
    router.pathname.startsWith(path)
  );

  const muiTheme = useMemo(() => getMuiTheme(theme), [theme]);

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
