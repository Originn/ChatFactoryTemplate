import '@/styles/base.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import AuthWrapper from '../auth/AuthWrapper'; 
import { useRouter } from 'next/router';
import { useEffect } from 'react'; // Import useEffect
import { applyActionCode } from 'firebase/auth';
import { auth } from 'utils/firebase';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const handleEmailVerification = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      const oobCode = urlParams.get('oobCode');
      const apiKey = urlParams.get('apiKey');

      if (mode === 'verifyEmail' && oobCode && apiKey) {
        try {
          await applyActionCode(auth, oobCode); 
          alert('Your email has been verified. You are being redirected...');
          router.push('/'); // Redirect to the root of your app
        } catch (error) {
          console.error('Error verifying email:', error);
          // Handle error appropriately (show error message, redirect, etc.)
        }
      }
    };

    handleEmailVerification();
  }, [router]); // Add router as a dependency for useEffect

  return (
    <>
      {router.pathname === '/verify-email' ? (
        <Component {...pageProps} /> // No AuthWrapper for verification
      ) : (
        <AuthWrapper>
          <Component {...pageProps} />
        </AuthWrapper>
      )}
    </>
  );
}

export default MyApp;