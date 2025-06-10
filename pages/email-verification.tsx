// UPDATED: Email verification page for Firebase-verified users
// Version: 2.1 - Firebase redirect handler
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { 
  applyActionCode, 
  signInWithEmailAndPassword, 
  checkActionCode,
  updatePassword
} from 'firebase/auth';
import { auth } from 'utils/firebase';

interface VerificationState {
  step: 'verifying' | 'set-password' | 'success' | 'error';
  email?: string;
  error?: string;
}

const EmailVerificationPage = () => {
  const router = useRouter();
  const [state, setState] = useState<VerificationState>({ step: 'verifying' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleEmailVerification = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      const oobCode = urlParams.get('oobCode');
      const chatbotId = urlParams.get('chatbot');

      console.log('🔍 Email verification debug:', { mode, hasOobCode: !!oobCode, chatbotId });

      // Check if this is a Firebase redirect (no mode/oobCode but has chatbot)
      if (!mode && !oobCode && chatbotId) {
        console.log('🔧 Firebase redirect detected - email already verified by Firebase');
        // Firebase already handled verification and redirected here
        // Show password setup form directly
        setState({ 
          step: 'set-password',
          email: 'your verified email' // We'll get this from auth state or user input
        });
        return;
      }

      if (mode === 'verifyEmail' && oobCode) {
        try {
          // First check the action code to get email information
          console.log('🔧 Checking action code...');
          const actionCodeInfo = await checkActionCode(auth, oobCode);
          const userEmail = actionCodeInfo.data.email || '';
          console.log('✅ Action code checked, email:', userEmail);
          
          // Apply the email verification code
          console.log('🔧 Applying action code...');
          await applyActionCode(auth, oobCode);
          console.log('✅ Action code applied successfully');
          
          // Check if user is now authenticated
          console.log('🔍 Auth state after applyActionCode:', {
            currentUser: !!auth.currentUser,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified
          });
          
          // Show password creation form
          setState({ 
            step: 'set-password',
            email: userEmail
          });
        } catch (error: any) {
          console.error('❌ Error verifying email:', error);
          setState({ 
            step: 'error', 
            error: `Failed to verify email: ${error.message}. The link may be expired or invalid.` 
          });
        }
      } else {
        setState({ 
          step: 'error', 
          error: 'Invalid verification link.' 
        });
      }
    };

    if (router.isReady) {
      handleEmailVerification();
    }
  }, [router.isReady]);

  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setState(prev => ({ ...prev, error: 'Passwords do not match' }));
      return;
    }
    
    if (password.length < 6) {
      setState(prev => ({ ...prev, error: 'Password must be at least 6 characters' }));
      return;
    }

    if (!state.email && !userEmail) {
      setState(prev => ({ ...prev, error: 'Email address is required' }));
      return;
    }

    // Use email from verification state or user input
    const emailToUse = state.email && state.email !== 'your verified email' ? state.email : userEmail;

    setIsLoading(true);
    console.log('🔧 Attempting to set password for email:', emailToUse);
    console.log('🔍 Current auth state:', {
      currentUser: !!auth.currentUser,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified
    });
    
    try {
      // Check if user is already authenticated from email verification
      if (auth.currentUser) {
        console.log('✅ User is authenticated, setting password directly...');
        // User is already authenticated after email verification, just set password
        await updatePassword(auth.currentUser, password);
        console.log('✅ Password set successfully!');
        
        setState({ step: 'success' });
        
        // Redirect to chatbot after success
        setTimeout(() => {
          router.push('/');
        }, 2000);
        
      } else {
        console.log('⚠️ User not authenticated, trying sign in...');
        // User is not authenticated, try to sign in (this might fail for invited users)
        await signInWithEmailAndPassword(auth, emailToUse, password);
        console.log('✅ Sign in successful!');
        
        setState({ step: 'success' });
        
        // Redirect to chatbot after success
        setTimeout(() => {
          router.push('/');
        }, 2000);
      }
      
    } catch (error: any) {
      // If sign in fails, it might be because they need to set password first
      console.error('❌ Sign in error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-login-credentials') {
        setState(prev => ({ 
          ...prev, 
          error: 'There was an issue setting up your account. Please contact support.' 
        }));
      } else if (error.code === 'auth/user-not-found') {
        setState(prev => ({ 
          ...prev, 
          error: 'User account not found. Please contact support.' 
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          error: `Authentication failed: ${error.message}` 
        }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    switch (state.step) {
      case 'verifying':
        return (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Verifying Email...</h1>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-xs text-gray-500 mt-4">Template v2.0 - Email Verification Handler</p>
          </div>
        );

      case 'set-password':
        return (
          <div>
            <h1 className="text-2xl font-bold mb-6 text-center">Set Your Password</h1>
            <p className="text-gray-600 mb-6 text-center">
              Welcome! Your email has been verified. Please create a password to access the chatbot.
            </p>
            
            <form onSubmit={handlePasswordSetup} className="space-y-4">
              {(!state.email || state.email === 'your verified email') && (
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your email address"
                    required
                  />
                </div>
              )}
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your password"
                  required
                  minLength={6}
                />
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Confirm your password"
                  required
                  minLength={6}
                />
              </div>
              
              {state.error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                  {state.error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoading || !password || !confirmPassword}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Setting Password...' : 'Create Password & Access Chatbot'}
              </button>
            </form>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4 text-green-600">Success!</h1>
            <p className="text-gray-600 mb-4">
              Your password has been set successfully. Redirecting you to the chatbot...
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4 text-red-600">Verification Failed</h1>
            <p className="text-red-600 mb-4">{state.error}</p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
            >
              Go to Chatbot
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        {renderContent()}
      </div>
    </div>
  );
};

export default EmailVerificationPage;