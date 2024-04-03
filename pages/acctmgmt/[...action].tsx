import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { applyActionCode, reload, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from 'utils/firebase';

const ActionHandlerPage = () => {
  const router = useRouter();

  useEffect(() => {
    const handleFirebaseActions = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      const actionCode = urlParams.get('oobCode');

      if (!mode || !actionCode) {
        console.error('Error: Mode or code is missing from the URL');
        return;
      }

      switch (mode) {
        case 'verifyEmail':
          await verifyEmail(actionCode);
          break;
        case 'resetPassword':
          // Navigate to a custom password reset page, or handle it directly here
          router.push(`/reset-password?oobCode=${actionCode}`);
          break;
        default:
          console.error('Error: Unrecognized mode in URL');
      }
    };

    const verifyEmail = async (actionCode : any) => {
      try {
        await applyActionCode(auth, actionCode);
        if (auth.currentUser) {
          await reload(auth.currentUser);
          router.push('/'); // Navigate after successful email verification
        }
      } catch (error) {
        console.error('Error verifying email:', error);
        // Handle error
      }
    };

    handleFirebaseActions();
  }, []);

  return (
    <div className="custom-action-handler-container">
      <h1>Processing your request...</h1>
      <p>Please wait...</p> {/* Display a loading message or spinner */}
    </div>
  );
};

export default ActionHandlerPage;
