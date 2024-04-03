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
  const { action, oobCode } = router.query; // Destructure oobCode directly if available

  useEffect(() => {
    // Ensure that `oobCode` is defined and is a string before proceeding
    const code = Array.isArray(oobCode) ? oobCode[0] : oobCode;
    if (!code) return; // Early return if `code` is undefined

    if (action === 'verifyEmail') {
        applyActionCode(auth, code)
            .then(() => {
                setMessage('Email verified successfully. Please log in.');
                if (auth.currentUser) {
                    reload(auth.currentUser);
                }
                // Optionally redirect the user after a delay
                // setTimeout(() => router.push('/sign-in'), 3000);
            })
            .catch((error) => {
                setError('Failed to verify email. ' + error.message);
            });
    }
}, [action, oobCode, router]);

const handleResetPassword = async (e : any) => {
    e.preventDefault();
    // Ensure that `oobCode` is defined and is a string before proceeding
    const code = Array.isArray(oobCode) ? oobCode[0] : oobCode;
    if (!code) {
        setError("Operation code is missing.");
        return; // Stop execution if `code` is undefined
    }

    if (newPassword !== confirmPassword) {
        setError("Passwords don't match.");
        return;
    }

    try {
        await confirmPasswordReset(auth, code, newPassword);
        setMessage('Your password has been reset successfully. Please log in.');
        router.push('/sign-in'); // Redirect user to sign-in page
    } catch (error : any) {
        setError('Failed to reset password. ' + error.message);
    }
};

  return (
    <div className="custom-action-container">
      {action === 'resetPassword' && (
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
      {action === 'verifyEmail' && (
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
