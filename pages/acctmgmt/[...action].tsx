import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { applyActionCode, reload, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from 'utils/firebase';

const ActionHandlerPage = () => {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState('');
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState('');
    const [actionCode, setActionCode] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const code = urlParams.get('oobCode');

    if (!mode || !code) {
      console.error('Error: Mode or code is missing from the URL');
      return;
    }

    // Set the action code in state
    setActionCode(code);

    const verifyEmail = async () => {
      try {
        await applyActionCode(auth, code);
        if (auth.currentUser) {
          await reload(auth.currentUser);
          router.push('/'); // Navigate after successful email verification
        }
      } catch (error) {
        console.error('Error verifying email:', error);
        // Handle error
      }
    };

    const handleAction = async () => {
      switch (mode) {
        case 'verifyEmail':
          await verifyEmail();
          break;
        case 'resetPassword':
          setIsResettingPassword(true); // Enable password reset mode
          break;
        default:
          console.error('Error: Unrecognized mode in URL');
      }
    };

    handleAction();
  }, [router]);

  const resetPassword = async () => {
    try {
      // Assuming actionCode and newPassword are available and valid
      await confirmPasswordReset(auth, actionCode, newPassword);
      // Show confirmation message
      setConfirmationMessage('Your password has been reset successfully.');

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/login'); // replace '/login' with your desired route
      }, 2000);
    } catch (error) {
      console.error('Error resetting password:', error);
      setConfirmationMessage('Failed to reset password. Please try again.');
    }
  };

  return (
    <div className="passw-reset-popup-backdrop">
      <div className="passw-reset-popup">
        {isResettingPassword ? (
          <div className="passw-reset-popup-body">
            {confirmationMessage ? (
              <div className={confirmationMessage.startsWith("Your password has") ? "confirmation-message" : "error-message"}>
                {confirmationMessage}
              </div>
            ) : (
              <>
                <h2>Reset Your Password</h2>
                <input
                  type="password"
                  className="passw-reset-popup-body-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
                <button
                  className="passw-reset-next-button"
                  onClick={resetPassword}
                >
                  Reset Password
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="passw-reset-popup-body">
            <h1>Processing your request...</h1>
            <p>Please wait...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionHandlerPage;