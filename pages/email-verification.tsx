// UPDATED: Email verification page for Firebase-verified users
// Version: 2.2 - Material-UI styling + Firebase config debug
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { 
  applyActionCode, 
  signInWithEmailAndPassword, 
  checkActionCode,
  updatePassword
} from 'firebase/auth';
import { auth } from 'utils/firebase';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Container
} from '@mui/material';

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
      // Debug Firebase config
      console.log('🔧 Email Verification Debug - Firebase Config:', {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.slice(0, 20) + '...',
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        hasValidConfig: !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
                          process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN && 
                          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
      });

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
          <Container maxWidth="sm" sx={{ mt: 8 }}>
            <Card elevation={3}>
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
                  Verifying Email...
                </Typography>
                <CircularProgress size={40} sx={{ my: 3 }} />
                <Typography variant="body2" color="text.secondary">
                  Template v2.2 - Email Verification Handler
                </Typography>
              </CardContent>
            </Card>
          </Container>
        );

      case 'set-password':
        return (
          <Container maxWidth="sm" sx={{ mt: 8 }}>
            <Card elevation={3}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom textAlign="center" fontWeight={600}>
                  Set Your Password
                </Typography>
                <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
                  Welcome! Your email has been verified. Please create a password to access the chatbot.
                </Typography>
                
                <Box component="form" onSubmit={handlePasswordSetup} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {(!state.email || state.email === 'your verified email') && (
                    <TextField
                      type="email"
                      label="Email Address"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      fullWidth
                      required
                      variant="outlined"
                      autoComplete="email"
                    />
                  )}
                  
                  <TextField
                    type="password"
                    label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    required
                    variant="outlined"
                    inputProps={{ minLength: 6 }}
                    helperText="Password must be at least 6 characters"
                  />
                  
                  <TextField
                    type="password"
                    label="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    fullWidth
                    required
                    variant="outlined"
                    inputProps={{ minLength: 6 }}
                  />
                  
                  {state.error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {state.error}
                    </Alert>
                  )}
                  
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isLoading || !password || !confirmPassword}
                    sx={{ mt: 2, py: 1.5 }}
                  >
                    {isLoading ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        Setting Password...
                      </>
                    ) : (
                      'Create Password & Access Chatbot'
                    )}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Container>
        );

      case 'success':
        return (
          <Container maxWidth="sm" sx={{ mt: 8 }}>
            <Card elevation={3}>
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h4" component="h1" gutterBottom fontWeight={600} color="success.main">
                  Success!
                </Typography>
                <Typography variant="body1" sx={{ mb: 3 }}>
                  Your password has been set successfully. Redirecting you to the chatbot...
                </Typography>
                <CircularProgress size={30} color="success" />
              </CardContent>
            </Card>
          </Container>
        );

      case 'error':
        return (
          <Container maxWidth="sm" sx={{ mt: 8 }}>
            <Card elevation={3}>
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h4" component="h1" gutterBottom fontWeight={600} color="error.main">
                  Verification Failed
                </Typography>
                <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
                  {state.error}
                </Alert>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => router.push('/')}
                >
                  Go to Chatbot
                </Button>
              </CardContent>
            </Card>
          </Container>
        );

      default:
        return null;
    }
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        backgroundColor: 'background.default',
        py: 4
      }}
    >
      {renderContent()}
    </Box>
  );
};

export default EmailVerificationPage;