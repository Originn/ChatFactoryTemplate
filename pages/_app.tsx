// pages/_app.tsx
import '@/styles/base.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import AuthWrapper from '../auth/AuthWrapper'; 
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();


  const noAuthRequired = ['/verify-email', '/verification-sent', '/password-reset-confirmation', '/acctmgmt'];
  const isAuthRequired = !noAuthRequired.some(path => router.pathname.startsWith(path));

  return (
    <>
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