// pages/_app.tsx
import '@/styles/base.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import AuthWrapper from '../auth/AuthWrapper'; 
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <>
      {/* Only wrap protected pages in AuthWrapper */}
      {router.pathname !== '/verify-email' ? ( 
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