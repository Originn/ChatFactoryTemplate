import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { applyActionCode, reload } from 'firebase/auth';
import { auth } from 'utils/firebase';

const VerifyEmailPage = () => {
  const router = useRouter();
  // Define the state with a type that can be null or string
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    const handleEmailVerification = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      const oobCode = urlParams.get('oobCode');

      if (mode === 'verifyEmail' && oobCode) {
        try {
          await applyActionCode(auth, oobCode);
          if (auth.currentUser) {
            await reload(auth.currentUser);
            router.push('/'); // Navigate after reload
          } else {
            // Handle the situation where the user is not logged in or the session has expired
            setError('No active session found. Please log in and try again.');
          }
        } catch (error) {
          console.error('Error verifying email:', error);
          setError('Failed to verify email. Please ensure the link is correct or try again later.');
        }
      } else {
        setError('Verification link is invalid or expired.');
      }
    };

    handleEmailVerification();
  }, []);

  return (
    <div className="custom-verify-container">
      <h1>Email Verification</h1>
      {error ? (
        <p className="error-message">{error}</p>
      ) : (
        <p>Verifying your email...</p> // Display a loading message or spinner
      )}
    </div>
  );
};

export default VerifyEmailPage;
