import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { applyActionCode, verifyPasswordResetCode, confirmPasswordReset, reload } from 'firebase/auth';
import { auth } from '../../utils/firebase'; // Adjust the import path as needed

const ActionHandlerPage = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
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
            router.push('/'); // Navigate after reload to ensure user state is up to date
          } else {
            // If currentUser is not available right after email verification,
            // you might need to handle this scenario depending on your app's flow.
            // For instance, you might want to prompt login or directly sign-in the user again.
            console.log('User not loaded immediately after email verification');
          }
        } catch (error: any) {
          console.error('Error verifying email:', error);
          setError('Failed to verify email. ' + error.message);
        }
      }
    };

    handleEmailVerification();
  }, []);

  const handleResetPassword = async (e: any) => {
    e.preventDefault();
    const urlParams = new URLSearchParams(window.location.search);
    const oobCode = urlParams.get('oobCode');

    if (!oobCode) {
      setError("Operation code is missing.");
      return; // Stop execution if `oobCode` is undefined
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setMessage('Your password has been reset successfully. Please log in.');
      router.push('/sign-in'); // Redirect user to sign-in page
    } catch (error: any) {
      setError('Failed to reset password. ' + error.message);
    }
  };

  return (
    <div className="custom-action-container">
      {/* Handle password reset */}
      {(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('mode') === 'resetPassword';
      })() && (
        <>
          <h1>Reset Your Password</h1>
          {error && <p className="error-message">{error}</p>}
          {message && <p className="success-message">{message}</p>}
          <form onSubmit={handleResetPassword}>
            <label>
              New Password:
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>
            <label>
              Confirm Password:
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit">Reset Password</button>
          </form>
        </>
      )}
      {/* Display a message for email verification */}
      {(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('mode') === 'verifyEmail';
      })() && (
        <div>
          {message && <p className="success-message">{message}</p>}
          {error && <p className="error-message">{error}</p>}
        </div>
      )}
      {/* Optionally handle other actions like 'recoverEmail' */}
    </div>
  );
};

export default ActionHandlerPage;