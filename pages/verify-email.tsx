import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { applyActionCode } from 'firebase/auth';
import { auth } from 'utils/firebase';

const VerifyEmailPage = () => {
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(true); // Track verification process

  useEffect(() => {
    const handleEmailVerification = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      const oobCode = urlParams.get('oobCode');
      const apiKey = urlParams.get('apiKey');

      if (mode === 'verifyEmail' && oobCode && apiKey) {
        console.log('Attempting to verify email...'); // Log attempt
        try {
          await applyActionCode(auth, oobCode);
          console.log('Email successfully verified.'); // Log success
          sessionStorage.setItem('emailVerified', 'true');
          setIsVerifying(false); // Update state to reflect verification success
          router.push('/');
        } catch (error) {
          console.error('Error verifying email:', error);
          setIsVerifying(false); // Update state to reflect verification failure
          // Optionally, set an error state here to display the error to the user
        }
      } else {
        // If we're missing any parameters, log an error or handle it as needed
        console.log('Verification parameters missing.');
        setIsVerifying(false); // Update state to reflect missing parameters
      }
    };

    handleEmailVerification();
  }, [router]);

  if (isVerifying) {
    return (
      <div className="custom-verify-container">
        <h1>Email Verification</h1>
        <p>Verifying your email...</p> {/* Display a loading message or spinner */}
      </div>
    );
  } else {
    // Optionally, show a different message or component upon verification success/failure
    return (
      <div className="custom-verify-container">
        <h1>Verification Complete</h1>
        <p>Your email has been successfully verified.</p>
      </div>
    );
  }
};

export default VerifyEmailPage;
