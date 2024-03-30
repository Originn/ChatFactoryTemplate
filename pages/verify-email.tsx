// pages/verify-email.tsx
import React from 'react';

const VerifyEmailPage = () => {
  // This page is purely informational and doesn't need to use authentication state or router.

  return (
    <div className="custom-verify-container">
      <h1>Email Verification</h1>
      <p>Please check your email to verify your account. Once verified, you may continue to use the application.</p>
    </div>
  );
};

export default VerifyEmailPage;