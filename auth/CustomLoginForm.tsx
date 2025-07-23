// auth/CustomLoginForm.tsx - Updated to support both Open Signup and Admin-Managed modes
import React, { useState, useEffect, useRef } from 'react';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification
} from 'firebase/auth';
import { auth } from 'utils/firebase';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { getChatbotBranding } from '../utils/logo';
import { isAdminManagedChatbot, isOpenSignupChatbot, getChatbotConfig } from '../utils/chatbotConfig';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Container,
  Alert,
  Link,
  Divider,
  IconButton,
} from '@mui/material';
import { IconButton as MuiIconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import useTheme from '../hooks/useTheme';

const ThemeToggleButton = styled(MuiIconButton)(({ theme }) => ({
  position: 'absolute',
  top: 20,
  left: 20,
  width: 40,
  height: 40,
  color: theme.palette.mode === 'dark' ? 'white' : 'inherit',
  '&:hover': {
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)'
  }
}));

const GoogleButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#f5f5f5',
  color: '#333333',
  border: '1px solid #dadce0',
  '&:hover': {
    backgroundColor: '#e8e8e8',
    boxShadow: '0 1px 2px 0 rgba(60,64,67,.30), 0 1px 3px 1px rgba(60,64,67,.15)',
  },
  textTransform: 'none',
  fontWeight: 500,
  padding: '10px 24px',
}));

type AuthMode = 'signin' | 'signup';

const CustomLoginForm = () => {    // Get chatbot branding and configuration
    const chatbotBranding = getChatbotBranding();
    const chatbotConfig = getChatbotConfig();
    const isAdminManaged = isAdminManagedChatbot();
    const isOpenSignup = isOpenSignupChatbot();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [emailSubmitted, setEmailSubmitted] = useState(false);
    const [isEmailValid, setIsEmailValid] = useState(false);
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [authMode, setAuthMode] = useState<AuthMode>('signin');
    const passwordInputRef = useRef<HTMLInputElement>(null);
    
    // Logo loading state
    const [logoError, setLogoError] = useState(false);
    const [logoLoaded, setLogoLoaded] = useState(false);

    const { theme, toggleTheme } = useTheme();
    const router = useRouter();

    // Ensure body background is set for login page
    useEffect(() => {
        document.body.style.backgroundColor = theme === 'dark' ? '#000000' : '#f8fafc';
        document.body.style.color = theme === 'dark' ? '#f1f5f9' : '#1e293b';
        return () => {
            // Clean up on unmount
            document.body.style.backgroundColor = '';
            document.body.style.color = '';
        };
    }, [theme]);

    const baseURL = process.env.NODE_ENV === 'production' ? '/' : '/';
    const moonIcon = `${baseURL}icons8-moon-50.png`;
    const iconPath = theme === 'light' ? moonIcon : "/icons8-sun.svg";

    // Initialize Google Auth Provider
    const googleProvider = new GoogleAuthProvider();
    // Logo handling functions
    const handleLogoLoad = () => {
        setLogoLoaded(true);
        setLogoError(false);
    };

    const handleLogoError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        console.error('❌ Logo failed to load:', chatbotBranding.logoUrl);
        setLogoError(true);
        
        const target = e.target as HTMLImageElement;
        if (target.src !== '/bot-icon-generic.svg') {
            target.src = '/bot-icon-generic.svg';
        }
    };

    // Google Sign-In
    const handleGoogleSignIn = async () => {
        try {
            setIsSubmitting(true);
            setErrorMessage('');
            
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            
            // Create or update user profile in Firestore for Google OAuth users
            const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;
            const chatbotName = process.env.NEXT_PUBLIC_CHATBOT_NAME || 'AI Assistant';
            
            if (chatbotId && user.email) {
                try {
                    const { doc, setDoc, serverTimestamp, getDoc } = await import('firebase/firestore');
                    const { db } = await import('../utils/firebase');
                    
                    const userDocRef = doc(db, 'users', user.uid);
                    const existingDoc = await getDoc(userDocRef);
                    
                    if (!existingDoc.exists()) {
                        // Create new user profile for first-time Google sign-in
                        const userProfile = {
                            originalEmail: user.email,
                            displayName: user.displayName || user.email,
                            chatbotId: chatbotId,
                            chatbotName: chatbotName,
                            createdAt: serverTimestamp(),
                            lastLoginAt: serverTimestamp(),
                            signInProvider: 'google'
                        };
                        
                        await setDoc(userDocRef, userProfile);
                    } else {
                        // Update last login time for existing user
                        await setDoc(userDocRef, {
                            lastLoginAt: serverTimestamp()
                        }, { merge: true });
                    }
                } catch (profileError) {
                    console.error('⚠️ Failed to create/update user profile, but sign-in successful:', profileError);
                    // Don't block the user from signing in if profile creation fails
                }
            }
            
            router.push('/');
        } catch (error: any) {
            console.error('❌ Google sign-in error:', error);
            if (error.code === 'auth/popup-closed-by-user') {
                setErrorMessage('Sign-in was cancelled.');
            } else if (error.code === 'auth/popup-blocked') {
                setErrorMessage('Popup was blocked. Please allow popups and try again.');
            } else {
                setErrorMessage('Google sign-in failed. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };
    // Email/Password Sign-In
    const handleSignInWithEmail = async () => {
        if (!email.trim() || !password.trim()) {
            setErrorMessage('Please enter both email and password.');
            return;
        }

        try {
            setIsSubmitting(true);
            setErrorMessage('');
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            
            if (userCredential.user.emailVerified) {
                console.log('✅ User signed in successfully:', userCredential.user.email);
                router.push('/');
            } else {
                setErrorMessage('Please verify your email address. Check your inbox for a verification email.');
            }
        } catch (error: any) {
            console.error('❌ Sign-in error:', error);
            switch (error.code) {
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    setErrorMessage('Incorrect email or password.');
                    break;
                case 'auth/user-not-found':
                    if (isAdminManaged) {
                        setErrorMessage('No account found with this email. Please contact the administrator to get invited.');
                    } else {
                        setErrorMessage('No account found with this email.');
                    }
                    break;
                case 'auth/too-many-requests':
                    setErrorMessage('Too many failed attempts. Please wait a few minutes and try again.');
                    break;
                case 'auth/user-disabled':
                    setErrorMessage('This account has been disabled. Please contact the administrator.');
                    break;
                case 'auth/invalid-email':
                    setErrorMessage('Please enter a valid email address.');
                    break;
                default:
                    setErrorMessage('Sign-in failed. Please check your credentials and try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };
    // Email/Password Sign-Up (only for Open Signup)
    const handleSignUpWithEmail = async () => {
        if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
            setErrorMessage('Please fill in all fields.');
            return;
        }

        if (password !== confirmPassword) {
            setErrorMessage('Passwords do not match.');
            return;
        }

        if (password.length < 6) {
            setErrorMessage('Password must be at least 6 characters long.');
            return;
        }

        try {
            setIsSubmitting(true);
            setErrorMessage('');
            
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            // Send email verification
            await sendEmailVerification(userCredential.user);
            
            setSuccessMessage('Account created successfully! Please check your email to verify your account before signing in.');
            setAuthMode('signin');
            setPassword('');
            setConfirmPassword('');
            
        } catch (error: any) {
            console.error('❌ Sign-up error:', error);
            switch (error.code) {
                case 'auth/email-already-in-use':
                    setErrorMessage('An account with this email already exists.');
                    break;
                case 'auth/weak-password':
                    setErrorMessage('Password is too weak. Please choose a stronger password.');
                    break;
                case 'auth/invalid-email':
                    setErrorMessage('Please enter a valid email address.');
                    break;
                default:
                    setErrorMessage('Account creation failed. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };
    const handleNextClick = async () => {
        if (!validateEmail(email)) {
            setErrorMessage('Please enter a valid email address.');
            return;
        }
        setEmailSubmitted(true);
        setErrorMessage('');
        setSuccessMessage('');
    };

    const handleBackClick = () => {
        setEmailSubmitted(false);
        setPassword('');
        setConfirmPassword('');
        setErrorMessage('');
        setSuccessMessage('');
    };

    useEffect(() => {
        if (emailSubmitted && passwordInputRef.current) {
            passwordInputRef.current.focus();
        }
    }, [emailSubmitted]);

    const validateEmail = (email: any) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    };

    const handleEmailChange = (e: any) => {
        const inputEmail = e.target.value;
        setEmail(inputEmail);
        const isValid = validateEmail(inputEmail);
        setIsEmailValid(isValid);
        if (errorMessage && isValid) {
            setErrorMessage('');
        }
        if (successMessage) {
            setSuccessMessage('');
        }
        if (e.key === 'Enter' && isValid && !errorMessage) {
            e.preventDefault();
            handleNextClick();
        }
    };
    const handlePasswordKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (authMode === 'signin') {
                handleSignInWithEmail();
            } else {
                handleSignUpWithEmail();
            }
        }
    };

    const openForgotPasswordModal = () => {
        setRecoveryEmail(email);
        setShowForgotPasswordModal(true);
        setErrorMessage('');
    };

    const handleSendPasswordResetEmail = async (e: any) => {
        e.preventDefault();
        if (!validateEmail(recoveryEmail)) {
            setErrorMessage("Please enter a valid email address.");
            return;
        }

        try {
            await sendPasswordResetEmail(auth, recoveryEmail);
            setShowForgotPasswordModal(false);
            setErrorMessage('');
            alert('Password reset email sent! Please check your inbox.');
        } catch (error: any) {
            console.error("Failed to send password reset email:", error);
            if (error.code === 'auth/user-not-found') {
                setErrorMessage("No account found with this email address.");
            } else {
                setErrorMessage("Failed to send password reset email. Please try again later.");
            }
        }
    };

    const getTitle = () => {
        if (isAdminManaged) {
            return `Sign in to ${chatbotConfig.name}`;
        } else if (isOpenSignup) {
            return authMode === 'signin' ? 'Welcome Back!' : 'Create Account';
        } else {
            return 'Welcome Back!';
        }
    };

    const getSubtitle = () => {
        if (isAdminManaged) {
            return 'This is an invitation-only chatbot. Sign in with your invited account.';
        } else if (isOpenSignup && authMode === 'signup') {
            return 'Create your account to get started.';
        }
        return null;
    };
    return (
        <Box
            sx={{
                minHeight: '100vh',
                backgroundColor: theme === 'dark' ? '#000000' : '#f8fafc',
                color: theme === 'dark' ? '#f1f5f9' : '#1e293b'
            }}
        >
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{getTitle()}</title>
            </Head>
            
            <ThemeToggleButton onClick={toggleTheme}>
                {theme === 'dark' ? (
                    <Image src="/icons8-sun.svg" alt="Sun Icon" width={24} height={24} style={{ filter: 'invert(1)' }} />
                ) : (
                    <Image src={moonIcon} alt="Moon Icon" width={24} height={24} />
                )}
            </ThemeToggleButton>

            <Container 
                maxWidth="sm" 
                sx={{ 
                    minHeight: '100vh',
                    backgroundColor: theme === 'dark' ? '#000000' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    justifyContent="center"
                    minHeight="100vh"
                    py={3}
                    sx={{
                        backgroundColor: theme === 'dark' ? '#000000' : 'transparent'
                    }}
                >
                    {/* Logo Section */}
                    <Box mb={4} textAlign="center" sx={{ maxWidth: 200, mx: 'auto' }}>
                        
                        {/* Use regular img tag for Firebase Storage URLs */}
                        {chatbotBranding.logoUrl.includes('firebasestorage.googleapis.com') ? (
                            <img
                                src={logoError ? '/bot-icon-generic.svg' : chatbotBranding.logoUrl}
                                alt={`${chatbotBranding.name} Logo`}
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    maxHeight: '120px',
                                    objectFit: 'contain',
                                    display: logoLoaded || logoError ? 'block' : 'none'
                                }}
                                onLoad={handleLogoLoad}
                                onError={handleLogoError}
                            />
                        ) : (
                            <Image 
                                src={logoError ? '/bot-icon-generic.svg' : chatbotBranding.logoUrl} 
                                alt={`${chatbotBranding.name} Logo`} 
                                width={0}
                                height={0}
                                sizes="100vw"
                                style={{ 
                                    width: '100%', 
                                    height: 'auto', 
                                    maxHeight: '120px', 
                                    objectFit: 'contain',
                                    display: logoLoaded || logoError ? 'block' : 'none'
                                }}
                                onLoad={handleLogoLoad}
                                onError={handleLogoError}
                                priority
                            />
                        )}
                        
                        {/* Loading placeholder */}
                        {!logoLoaded && !logoError && (
                            <Box
                                sx={{
                                    width: '100%',
                                    height: '120px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'grey.100',
                                    borderRadius: 1
                                }}
                            >
                                <Typography variant="body2" color="text.secondary">
                                    Loading logo...
                                </Typography>
                            </Box>
                        )}
                    </Box>
                    {/* Sign In/Up Form */}
                    <Paper
                        elevation={3}
                        sx={{
                            width: '100%',
                            maxWidth: 400,
                            p: 4,
                            borderRadius: 2,
                            backgroundColor: theme === 'dark' ? '#000000' : 'white',
                            color: theme === 'dark' ? 'white' : 'inherit'
                        }}
                    >
                        <Typography variant="h4" component="h1" gutterBottom textAlign="center" fontWeight={600}>
                            {getTitle()}
                        </Typography>

                        {getSubtitle() && (
                            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
                                {getSubtitle()}
                            </Typography>
                        )}

                        {/* Success Message */}
                        {successMessage && (
                            <Alert severity="success" sx={{ mb: 2 }}>
                                {successMessage}
                            </Alert>
                        )}

                        {/* Google Sign-In Button (only for Open Signup) */}
                        {isOpenSignup && !emailSubmitted && (
                            <>
                                <GoogleButton
                                    fullWidth
                                    onClick={handleGoogleSignIn}
                                    disabled={isSubmitting}
                                    size="large"
                                    sx={{ mb: 2 }}
                                    startIcon={
                                        <Image
                                            src="/google.svg"
                                            alt="Google"
                                            width={18}
                                            height={18}
                                        />
                                    }
                                >
                                    Continue with Google
                                </GoogleButton>
                                
                                <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
                                    <Divider sx={{ flexGrow: 1 }} />
                                    <Typography variant="body2" sx={{ px: 2, color: 'text.secondary' }}>
                                        or
                                    </Typography>
                                    <Divider sx={{ flexGrow: 1 }} />
                                </Box>
                            </>
                        )}
                        {/* Email/Password Form */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {!emailSubmitted ? (
                                // Email Step
                                <>
                                    <TextField
                                        type="email"
                                        label="Email"
                                        required
                                        fullWidth
                                        value={email}
                                        onChange={handleEmailChange}
                                        onKeyDown={handleEmailChange}
                                        autoComplete="email"
                                        autoFocus
                                    />
                                    {errorMessage && (
                                        <Alert severity="error">{errorMessage}</Alert>
                                    )}
                                    <Button
                                        onClick={handleNextClick}
                                        variant="contained"
                                        fullWidth
                                        disabled={!isEmailValid || !!errorMessage}
                                        size="large"
                                    >
                                        Next
                                    </Button>
                                </>
                            ) : (
                                // Password Step
                                <>
                                    <TextField 
                                        type="email" 
                                        value={email} 
                                        disabled 
                                        fullWidth
                                        label="Email"
                                        size="small"
                                    />
                                    <TextField
                                        type="password"
                                        label="Password"
                                        required
                                        fullWidth
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            setErrorMessage('');
                                            setSuccessMessage('');
                                        }}
                                        inputRef={passwordInputRef}
                                        onKeyDown={handlePasswordKeyPress}
                                        autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                                    />                                    
                                    {/* Confirm Password (only for signup) */}
                                    {isOpenSignup && authMode === 'signup' && (
                                        <TextField
                                            type="password"
                                            label="Confirm Password"
                                            required
                                            fullWidth
                                            value={confirmPassword}
                                            onChange={(e) => {
                                                setConfirmPassword(e.target.value);
                                                setErrorMessage('');
                                            }}
                                            onKeyDown={handlePasswordKeyPress}
                                            autoComplete="new-password"
                                        />
                                    )}
                                    
                                    {errorMessage && (
                                        <Alert severity="error">
                                            {errorMessage.includes('Incorrect') && authMode === 'signin' ? (
                                                <>
                                                    {errorMessage}{' '}
                                                    <Link component="button" onClick={openForgotPasswordModal} type="button">
                                                        Reset password
                                                    </Link>
                                                </>
                                            ) : (
                                                errorMessage
                                            )}
                                        </Alert>
                                    )}
                                    
                                    <Button
                                        onClick={authMode === 'signin' ? handleSignInWithEmail : handleSignUpWithEmail}
                                        variant="contained"
                                        fullWidth
                                        disabled={!password.trim() || isSubmitting || (authMode === 'signup' && !confirmPassword.trim())}
                                        size="large"
                                    >
                                        {isSubmitting 
                                            ? (authMode === 'signin' ? 'Signing in...' : 'Creating account...') 
                                            : (authMode === 'signin' ? 'Sign In' : 'Create Account')
                                        }
                                    </Button>
                                    
                                    <Box textAlign="center">
                                        <Button 
                                            onClick={handleBackClick}
                                            variant="text" 
                                            size="small"
                                            color="primary"
                                        >
                                            ← Back to email
                                        </Button>
                                    </Box>
                                </>
                            )}
                        </Box>
                        {/* Footer - Mode Toggle for Open Signup */}
                        {isOpenSignup && !emailSubmitted && (
                            <Box mt={3} pt={2} borderTop={1} borderColor="divider" textAlign="center">
                                <Typography variant="body2" color="text.secondary">
                                    {authMode === 'signin' ? (
                                        <>
                                            Don't have an account?{' '}
                                            <Link 
                                                component="button" 
                                                onClick={() => {
                                                    setAuthMode('signup');
                                                    setErrorMessage('');
                                                    setSuccessMessage('');
                                                }}
                                                type="button"
                                            >
                                                Create one
                                            </Link>
                                        </>
                                    ) : (
                                        <>
                                            Already have an account?{' '}
                                            <Link 
                                                component="button" 
                                                onClick={() => {
                                                    setAuthMode('signin');
                                                    setErrorMessage('');
                                                    setSuccessMessage('');
                                                }}
                                                type="button"
                                            >
                                                Sign in
                                            </Link>
                                        </>
                                    )}
                                </Typography>
                            </Box>
                        )}

                        {/* Footer - Admin Managed Info */}
                        {isAdminManaged && (
                            <Box mt={3} pt={2} borderTop={1} borderColor="divider">
                                <Typography variant="body2" color="text.secondary" textAlign="center">
                                    Don't have an account? Contact your administrator to get invited.
                                </Typography>
                            </Box>
                        )}
                    </Paper>
                </Box>
            </Container>
            {/* Forgot Password Modal */}
            <Dialog open={showForgotPasswordModal} onClose={() => setShowForgotPasswordModal(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Reset Your Password</DialogTitle>
                <DialogContent>
                    <Box
                        component="form"
                        onSubmit={handleSendPasswordResetEmail}
                        sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}
                    >
                        <TextField
                            type="email"
                            label="Enter your email"
                            fullWidth
                            value={recoveryEmail}
                            onChange={(e) => {
                                setRecoveryEmail(e.target.value);
                                setErrorMessage('');
                            }}
                            required
                            autoFocus
                        />
                        {errorMessage && (
                            <Alert severity="error">{errorMessage}</Alert>
                        )}
                        <Button type="submit" variant="contained" fullWidth>
                            Send Reset Email
                        </Button>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowForgotPasswordModal(false)}>Cancel</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CustomLoginForm;