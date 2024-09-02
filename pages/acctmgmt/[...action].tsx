import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { applyActionCode, reload, confirmPasswordReset, checkActionCode } from 'firebase/auth';
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

        setActionCode(code);

        const verifyEmail = async () => {
          try {
            console.log('Checking action code...');
            const actionCodeInfo = await checkActionCode(auth, actionCode); // Ensure the code is valid
            console.log('Action code is valid:', actionCodeInfo);
        
            console.log('Applying action code...');
            await applyActionCode(auth, actionCode); // Apply the action code
        
            console.log('Redirecting to confirmation page...');
            router.push('/account-created-confirmation'); // Redirect to the confirmation page after verification
          } catch (error: any) {
            console.error('Error verifying email:', error);
        
            if (error.code === 'auth/invalid-action-code') {
              console.error('The action code is invalid or expired.');
              const email = auth.currentUser?.email || 'unknown@example.com'; // Get the user's email or use a fallback
              router.push({
                pathname: '/verification-failed',
                query: { email }, // Pass the correct user's email to the failure page
              });
            } else {
              console.error('An unexpected error occurred.');
              setConfirmationMessage('An unexpected error occurred. Please try again later.');
            }
          }
        };
        
      
        const handleAction = async () => {
            switch (mode) {
                case 'verifyEmail':
                    await verifyEmail();
                    break;
                case 'resetPassword':
                    setIsResettingPassword(true);
                    break;
                default:
                    console.error('Error: Unrecognized mode in URL');
            }
        };

        handleAction();
    }, [router]);

    const resetPassword = async () => {
        try {
            await confirmPasswordReset(auth, actionCode, newPassword);
            setConfirmationMessage('Your password has been reset successfully.');
            setTimeout(() => {
              window.location.href = 'https://www.solidcamchat.com/';
            }, 2000);
        } catch (error) {
            console.error('Error resetting password:', error);
            setConfirmationMessage('Failed to reset password. Please try again.');
        }
    };

    const getMessageClass = (message:any) => {
        if (message === "Your password has been reset successfully.") {
            return "success-message";  // Assigning a specific class for this message
        } else if (message.startsWith("Failed")) {
            return "error-message";
        } else if (message.startsWith("No user") || message.includes("Error")) {
            return "warning-message";  // Handle other types of messages
        } else {
            return "info-message";  // Default class for other info messages
        }
    };

    return (
        <div className="passw-reset-popup-backdrop">
            <div className="passw-reset-popup">
                {isResettingPassword ? (
                    <div className="passw-reset-popup-body">
                        {confirmationMessage ? (
                            <div className={getMessageClass(confirmationMessage)}>
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
                                    onKeyDown={(e) => e.key === 'Enter' && resetPassword()}
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
