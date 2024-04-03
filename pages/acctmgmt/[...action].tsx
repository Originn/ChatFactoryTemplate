import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { applyActionCode, reload, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from 'utils/firebase';

const ActionHandlerPage = () => {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
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
    if (!actionCode) {
      console.error('Error: Action code is missing');
      return;
    }
    try {
      await confirmPasswordReset(auth, actionCode, newPassword);
      setIsResettingPassword(false); // Reset complete, disable password reset mode
      router.push('/login'); // Navigate to login after resetting
    } catch (error) {
      console.error('Error resetting password:', error);
      // Handle error
    }
  };

  return (
    <div className="custom-action-handler-container">
      {isResettingPassword ? (
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
      ) : (
        <>
          <h1>Processing your request...</h1>
          <p>Please wait...</p> {/* Display a loading message or spinner */}
        </>
      )}
    </div>
  );
};

export default ActionHandlerPage;
