import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { applyActionCode, reload } from 'firebase/auth';
import { auth } from 'utils/firebase';

const VerifyEmailPage = () => {
  const router = useRouter();

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
            router.push('/'); // Now it's safe to navigate after reload
          }
        } catch (error) {
          console.error('Error verifying email:', error);
          // Handle error (e.g., display an error message)
        }
      }
    };

    handleEmailVerification();
  }, []);

  return (
    <div className="custom-verify-container">
      <h1>Email Verification</h1>
      <p>Verifying your email...</p> {/* Display a loading message or spinner */}
    </div>
  );
};

export default VerifyEmailPage;