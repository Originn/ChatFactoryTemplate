import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from 'utils/firebase';

const ResetPasswordPage = () => {
  const [newPassword, setNewPassword] = useState('');
  const router = useRouter();
  const { oobCode } = router.query;

  useEffect(() => {
    const verifyCode = async () => {
      // Ensure oobCode is a string before trying to use it
      const code = Array.isArray(oobCode) ? oobCode[0] : oobCode;
      if (typeof code !== 'string') return;
      try {
        await verifyPasswordResetCode(auth, code);
        // Code is valid, show form to input new password
      } catch (error) {
        console.error('Invalid or expired action code:', error);
        // Handle error, maybe navigate back or show an error message
      }
    };

    verifyCode();
  }, [oobCode]); // oobCode here is fine because it just triggers the effect

  const resetPassword = async () => {
    const code = Array.isArray(oobCode) ? oobCode[0] : oobCode;
    if (typeof code !== 'string') {
      console.error('Invalid action code type:', typeof code);
      return; // Early return if code is not a string
    }

    try {
      await confirmPasswordReset(auth, code, newPassword);
      // Password has been reset successfully
      router.push('/login'); // or wherever you want to navigate after resetting
    } catch (error) {
      console.error('Error resetting password:', error);
      // Handle error
    }
  };

  return (
    <div>
      <h1>Reset Your Password</h1>
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="Enter new password"
      />
      <button onClick={resetPassword}>Reset Password</button>
    </div>
  );
};

export default ResetPasswordPage;
