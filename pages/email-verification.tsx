import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { 
  applyActionCode, 
  signInWithEmailAndPassword, 
  checkActionCode
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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleEmailVerification = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      const oobCode = urlParams.get('oobCode');
      const chatbotId = urlParams.get('chatbot');

      if (mode === 'verifyEmail' && oobCode) {
        try {
          // First check the action code to get email information
          const actionCodeInfo = await checkActionCode(auth, oobCode);
          const userEmail = actionCodeInfo.data.email || '';
          
          // Apply the email verification code
          await applyActionCode(auth, oobCode);
          
          // Show password creation form
          setState({ 
            step: 'set-password',
            email: userEmail
          });
        } catch (error: any) {
          console.error('Error verifying email:', error);
          setState({ 
            step: 'error', 
            error: 'Failed to verify email. The link may be expired or invalid.' 
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

    if (!state.email) {
      setState(prev => ({ ...prev, error: 'Email address not found' }));
      return;
    }

    setIsLoading(true);
    
    try {
      // Since the user was created without a password during invitation,
      // and email is now verified, we can sign them in with email/password
      await signInWithEmailAndPassword(auth, state.email, password);
      
      setState({ step: 'success' });
      
      // Redirect to chatbot after success
      setTimeout(() => {
        router.push('/');
      }, 2000);
      
    } catch (error: any) {
      // If sign in fails, it might be because they need to set password first
      console.error('Sign in error:', error);
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-login-credentials') {
        setState(prev => ({ 
          ...prev, 
          error: 'There was an issue setting up your account. Please contact support.' 
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          error: error.message || 'Failed to complete setup. Please try again.' 
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