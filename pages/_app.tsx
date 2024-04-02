// pages/_app.tsx
import '@/styles/base.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import AuthWrapper from '../auth/AuthWrapper'; 
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();


  // Add the new verification sent page to the bypass list
  const noAuthRequired = ['/verify-email', '/verification-sent'];

  return (
    <>
      {noAuthRequired.includes(router.pathname) ? ( 
        <Component {...pageProps} /> 
      ) : (
        <AuthWrapper>
          <Component {...pageProps} />
        </AuthWrapper>
      )}
    </>
  );
}

export default MyApp;