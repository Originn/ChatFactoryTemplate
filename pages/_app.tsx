import '@/styles/base.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import AuthWrapper from '../auth/AuthWrapper';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState, useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { getMuiTheme } from '@/utils/muiTheme';
import { setUserIdForAnalytics } from '@/utils/tracking';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
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
    try {
      setUserIdForAnalytics();
    } catch (error) {
      console.error('Error setting user ID for analytics:', error);
    }
  }, []);

  const isAuthRequired = !noAuthRequired.some((path) =>
    router.pathname.startsWith(path)
  );

  const enhancedProps = {
    ...pageProps,
    initialTheme: theme,
  };

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
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <div className={theme}>
          {isAuthRequired ? (
            <AuthWrapper>
              <Component {...enhancedProps} />
            </AuthWrapper>
          ) : (
            <Component {...enhancedProps} />
          )}
        </div>
      </ThemeProvider>
    </>
  );
}

export default MyApp;