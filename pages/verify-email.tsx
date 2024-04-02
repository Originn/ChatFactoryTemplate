import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { applyActionCode } from 'firebase/auth';
import { auth } from 'utils/firebase';

const VerifyEmailPage = () => {
  const router = useRouter();
  const [verificationStatus, setVerificationStatus] = useState({verifying: true, success: false});
  const emailVerificationInitiated = useRef(false);

  useEffect(() => {
    if (!emailVerificationInitiated.current) {
      emailVerificationInitiated.current = true;
    const handleEmailVerification = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      const oobCode = urlParams.get('oobCode');

      // Check for the correct mode as per Firebase email verification URL parameter
      if (mode === 'verifyEmail' && oobCode) {
        console.log('Attempting to verify email...');
        try {
          await applyActionCode(auth, oobCode);
          console.log('Email successfully verified.');
          sessionStorage.setItem('emailVerified', 'true');
          setVerificationStatus({verifying: false, success: true});
          // Consider a slight delay or a confirmation message before redirection
          router.push('/');
        } catch (error) {
          console.error('Error verifying email:', error);
          setVerificationStatus({verifying: false, success: false});
          // Optionally, handle displaying the error to the user
        }
      } else {
        console.log('Verification parameters missing.');
        setVerificationStatus({verifying: false, success: false});
      }
    };

    handleEmailVerification();
  }}, []);

  if (verificationStatus.verifying) {
    return <div className="custom-verify-container"><h1>Email Verification</h1><p>Verifying your email...</p></div>;
  } else if (verificationStatus.success) {
    return <div className="custom-verify-container"><h1>Verification Successful</h1><p>Your email has been successfully verified.</p></div>;
  } else {
    return <div className="custom-verify-container"><h1>Verification Failed</h1><p>There was an issue verifying your email. Please try the verification link again or contact support if the problem persists.</p></div>;
  }
};

export default VerifyEmailPage;
