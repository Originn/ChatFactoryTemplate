// auth/CustomLoginForm.tsx - Updated for Admin-Managed Users (invitation-only)
import React, { useState, useEffect, useRef } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from 'utils/firebase';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { getChatbotBranding } from '../utils/logo';
import { isAdminManagedChatbot, getChatbotConfig } from '../utils/chatbotConfig';
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
} from '@mui/material';
import { styled } from '@mui/material/styles';
import useTheme from '@/hooks/useTheme';

const ThemeToggleButton = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 20,
  left: 20,
  padding: '8px',
  borderRadius: '50%',
  backgroundColor: theme.palette.mode === 'dark' ? 'white' : theme.palette.grey[600],
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.2s ease',
  '&:hover': {
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[200] : theme.palette.grey[700],
  },
}));

const CustomLoginForm = () => {
    // Get chatbot branding from environment variables
    const chatbotBranding = getChatbotBranding();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [emailSubmitted, setEmailSubmitted] = useState(false);
    const [isEmailValid, setIsEmailValid] = useState(false);
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const passwordInputRef = useRef<HTMLInputElement>(null);
    
    // Logo loading state
    const [logoError, setLogoError] = useState(false);
    const [logoLoaded, setLogoLoaded] = useState(false);

    const { theme, toggleTheme } = useTheme();
    const router = useRouter();

    const baseURL = process.env.NODE_ENV === 'production' ? '/' : '/';
    const moonIcon = `${baseURL}icons8-moon-50.png`;
    const iconPath = theme === 'light' ? moonIcon : "/icons8-sun.svg";

    // Check if this is an admin-managed (invitation-only) chatbot
    const isAdminManaged = isAdminManagedChatbot();
    const chatbotConfig = getChatbotConfig();
    const chatbotName = chatbotConfig.name;

    // Logo handling functions
    const handleLogoLoad = () => {
        console.log('✅ Logo loaded successfully:', chatbotBranding.logoUrl);
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
                    setErrorMessage('Incorrect password.');
                    break;
                case 'auth/user-not-found':
                    setErrorMessage('No account found with this email. Please contact the administrator to get invited.');
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

    const handleNextClick = async () => {
        if (!validateEmail(email)) {
            setErrorMessage('Please enter a valid email address.');
            return;
        }
        setEmailSubmitted(true);
        setErrorMessage('');
    };

    const handleBackClick = () => {
        setEmailSubmitted(false);
        setPassword('');
        setErrorMessage('');
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
        if (e.key === 'Enter' && isValid && !errorMessage) {
            e.preventDefault();
            handleNextClick();
        }
    };

    const handlePasswordKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSignInWithEmail();
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

    return (
        <>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{isAdminManaged ? `Sign in to ${chatbotName}` : `${chatbotName} - Sign In`}</title>
            </Head>
            
            <ThemeToggleButton onClick={toggleTheme}>
                <Image src={iconPath} alt={theme === 'dark' ? 'Light mode icon' : 'Dark mode icon'} width={24} height={24} />
            </ThemeToggleButton>

            <Container 
                maxWidth="sm" 
                sx={{ 
                    minHeight: '100vh',
                    backgroundColor: 'transparent',
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
                        backgroundColor: 'transparent'
                    }}
                >
                    {/* Logo Section */}
                    <Box mb={4} textAlign="center" sx={{ maxWidth: 200, mx: 'auto' }}>
                        {/* Debug info - only show in development */}
                        {process.env.NODE_ENV === 'development' && (
                            <Typography variant="caption" display="block" sx={{ mb: 1, color: 'text.secondary' }}>
                                Logo: {logoError ? 'Fallback' : logoLoaded ? 'Loaded' : 'Loading...'}
                            </Typography>
                        )}
                        
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

                    {/* Sign In Form */}
                    <Paper
                        elevation={3}
                        sx={{
                            width: '100%',
                            maxWidth: 400,
                            p: 4,
                            borderRadius: 2,
                        }}
                    >
                        <Typography variant="h4" component="h1" gutterBottom textAlign="center" fontWeight={600}>
                            {isAdminManaged ? `Sign in to ${chatbotName}` : 'Welcome Back!'}
                        </Typography>

                        {isAdminManaged && (
                            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
                                This is an invitation-only chatbot. Sign in with your invited account.
                            </Typography>
                        )}

                        {/* Sign In Form */}
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
                                        }}
                                        inputRef={passwordInputRef}
                                        onKeyDown={handlePasswordKeyPress}
                                        autoComplete="current-password"
                                    />
                                    {errorMessage && (
                                        <Alert severity="error">
                                            {errorMessage.includes('Incorrect password') ? (
                                                <>
                                                    Incorrect password.{' '}
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
                                        onClick={handleSignInWithEmail}
                                        variant="contained"
                                        fullWidth
                                        disabled={!password.trim() || isSubmitting}
                                        size="large"
                                    >
                                        {isSubmitting ? 'Signing in...' : 'Sign In'}
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

                        {/* Footer Info */}
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
        </>
    );
};

export default CustomLoginForm;