// auth/CustomLoginForm.tsx
import React, { useState, useEffect, useRef } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, OAuthProvider, fetchSignInMethodsForEmail, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from 'utils/firebase';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Cookies from 'js-cookie';
import { getChatbotBranding } from '../utils/logo';
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
  Divider,
  Container,
  IconButton,
  Stack,
  Alert,
  Link,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import useTheme from '@/hooks/useTheme';

// Styled components for provider buttons
const ProviderButton = styled(Button)(({ theme }) => ({
  width: '100%',
  padding: '12px 16px',
  marginBottom: '12px',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: '4px',
  textTransform: 'none',
  fontSize: '14px',
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover': {
    boxShadow: theme.shadows[2],
  },
}));

const AppleButton = styled(ProviderButton)(({ theme }) => ({
  backgroundColor: '#000',
  color: '#fff',
  '&:hover': {
    backgroundColor: '#333',
  },
}));

const GoogleButton = styled(ProviderButton)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
}));

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
    const [showModal, setShowModal] = useState(false);
    const [showSignInModal, setShowSignInModal] = useState(false);
    const [emailSubmitted, setEmailSubmitted] = useState(false);
    const [isEmailValid, setIsEmailValid] = useState(false);
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [consentGiven, setConsentGiven] = useState(false);
    const [showConsentModal, setShowConsentModal] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [consentDeclined, setConsentDeclined] = useState(false);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    const { theme, toggleTheme } = useTheme();
    const router = useRouter();

    const baseURL = process.env.NODE_ENV === 'production' ? '/' : '/';
    const moonIcon = `${baseURL}icons8-moon-50.png`;
    const iconPath = theme === 'light' ? moonIcon : "/icons8-sun.svg";

    useEffect(() => {
        const consentCookie = Cookies.get('userConsent');
        if (consentCookie === 'true') {
            setConsentGiven(true);
        }
    }, []);

    const handleSignInWithEmail = async () => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            if (userCredential.user.emailVerified) {
                router.push('/');
            } else {
                setErrorMessage('Your email is not verified. Please check your inbox or click here to resend the verification email.');
            }
        } catch (error: any) {
            console.error('Error during email sign-in:', error);
            switch (error.code) {
                case 'auth/wrong-password':
                    setErrorMessage('The password you entered is incorrect. Click here to reset your password.');
                    break;
                case 'auth/user-not-found':
                    setErrorMessage('No account found with this email. Please sign up.');
                    break;
                case 'auth/too-many-requests':
                    setErrorMessage('Too many requests detected. Click here to reset your password, or wait and try again.');
                    break;
                default:
                    setErrorMessage('An error occurred during sign in. Please try again later.');
            }
        }
    };

    const resendVerificationEmail = async () => {
        if (auth.currentUser) {
            try {
                await sendEmailVerification(auth.currentUser);
                router.push('/verification-sent');
            } catch (error) {
                console.error('Error resending verification email:', error);
                setErrorMessage('Failed to resend verification email. Please try again later.');
            }
        } else {
            setErrorMessage('No user is signed in to resend verification to.');
        }
    };

    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            router.push('/');
        } catch (error) {
            console.error('Error during Google sign-in:', error);
            setErrorMessage('Failed to sign in with Google. Please try again.');
        }
    };

    const signInWithApple = async () => {
        try {
            const provider = new OAuthProvider('apple.com');
            await signInWithPopup(auth, provider);
            router.push('/');
        } catch (error) {
            console.error('Error during Apple sign-in:', error);
            setErrorMessage('Failed to sign in with Apple. Please try again.');
        }
    };

    const createAccountWithEmail = async () => {
        setIsSubmitting(true);
        setErrorMessage('');
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userCredential.user);
            router.push('/verification-sent');
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                setErrorMessage('The email address is already in use by another account.');
            } else {
                const formattedError = error.message.replace('Firebase: ', '');
                setErrorMessage(formattedError);
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

    const openSignInPopup = () => {
        setEmail('');
        setPassword('');
        setErrorMessage('');
        setShowSignInModal(true);
    };

    const closeSignInPopup = () => {
        setShowSignInModal(false);
        setEmail('');
        setEmailSubmitted(false);
        setIsEmailValid(false);
        setErrorMessage('');
    };

    const openForgotPasswordPopup = () => {
        setShowSignInModal(false);
        setShowModal(false);
        setErrorMessage('');
        setRecoveryEmail(email);
        setShowForgotPasswordModal(true);
    };

    const handleSendPasswordResetEmail = async (e: any) => {
        e.preventDefault();
        if (!validateEmail(recoveryEmail)) {
            setErrorMessage("Please enter a valid email address.");
            return;
        }

        try {
            await sendPasswordResetEmail(auth, recoveryEmail);
            router.push('/password-reset-confirmation');
        } catch (error) {
            console.error("Failed to send password reset email:", error);
            setErrorMessage("Failed to send password reset email. Please try again later.");
        }
    };

    const handleProviderSignUp = (provider: any) => {
        setSelectedProvider(provider);
        
        const consentCookie = Cookies.get('userConsent');
        if (consentCookie !== 'true') {
            setShowConsentModal(true);
        } else {
            proceedWithProviderSignIn(provider);
        }
    };

    const proceedWithProviderSignIn = (provider: string | null) => {
        if (!provider) {
            console.error("Provider is null, cannot proceed with sign-in.");
            return;
        }

        if (provider === 'google') {
            signInWithGoogle();
        } else if (provider === 'apple') {
            signInWithApple();
        }
    };

    const acceptConsent = () => {
        setShowConsentModal(false);
        setConsentGiven(true);
        setConsentDeclined(false);
        Cookies.set('userConsent', 'true', { expires: 365 });

        if (selectedProvider) {
            proceedWithProviderSignIn(selectedProvider);
        } else {
            createAccountWithEmail();
        }
    };

    const declineConsent = () => {
        setShowConsentModal(false);
        setConsentDeclined(true);
        setSelectedProvider(null);
    };

    const handleCreateAccountClick = (e: React.FormEvent) => {
        e.preventDefault();
        if (email.trim() !== '' && password.trim() !== '') {
            if (!consentGiven) {
                setShowConsentModal(true);
            } else {
                createAccountWithEmail();
            }
        }
    };

    const toggleForm = () => {
        setShowSignInModal(false);
        setShowModal(true);
    };

    const backToSignInPopup = () => {
        setShowForgotPasswordModal(false);
        setShowSignInModal(true);
    };

    return (
        <>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            
            <ThemeToggleButton onClick={toggleTheme}>
                <Image src={iconPath} alt={theme === 'dark' ? 'Light mode icon' : 'Dark mode icon'} width={24} height={24} />
            </ThemeToggleButton>

            <Container maxWidth="sm">
                <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    justifyContent="center"
                    minHeight="100vh"
                    py={3}
                >
                    <Box mb={4} textAlign="center" sx={{ maxWidth: 200, mx: 'auto' }}>
                        <Image 
                            src={chatbotBranding.logoUrl} 
                            alt={`${chatbotBranding.name} Logo`} 
                            width={0}
                            height={0}
                            sizes="100vw"
                            style={{ width: '100%', height: 'auto', maxHeight: '120px', objectFit: 'contain' }}
                            onError={(e) => {
                                // Fallback to generic bot icon if custom logo fails to load
                                e.currentTarget.src = '/bot-icon-generic.svg';
                            }}
                        />
                    </Box>

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
                            Let's Chat!
                        </Typography>

                        <Stack spacing={2}>
                            <GoogleButton
                                onClick={() => handleProviderSignUp('google')}
                                startIcon={<Image src="/google.svg" alt="Google" width={20} height={20} />}
                            >
                                Sign in with Google
                            </GoogleButton>

                            <AppleButton
                                onClick={() => handleProviderSignUp('apple')}
                                startIcon={<Image src="/apple.svg" alt="Apple" width={20} height={20} />}
                            >
                                Sign in with Apple
                            </AppleButton>

                            <Box position="relative" textAlign="center" my={2}>
                                <Divider>
                                    <Typography variant="body2" color="text.secondary" px={2}>
                                        or
                                    </Typography>
                                </Divider>
                            </Box>

                            <Button
                                variant="contained"
                                color="primary"
                                fullWidth
                                onClick={() => setShowModal(true)}
                                sx={{ mb: 1 }}
                            >
                                Create account
                            </Button>

                            <Typography variant="body2" textAlign="center" color="text.secondary">
                                Already have an account?
                            </Typography>

                            <Button
                                variant="outlined"
                                color="primary"
                                fullWidth
                                onClick={openSignInPopup}
                            >
                                Sign in with Email
                            </Button>
                        </Stack>
                    </Paper>
                </Box>
            </Container>

            {/* Sign Up Modal */}
            <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Create Your Account</DialogTitle>
                <DialogContent>
                    <Box
                        component="form"
                        onSubmit={handleCreateAccountClick}
                        sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}
                    >
                        <TextField
                            type="email"
                            label="Email"
                            required
                            fullWidth
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setErrorMessage('');
                            }}
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
                        />
                        {errorMessage && (
                            <Alert severity="error">{errorMessage}</Alert>
                        )}
                        <Button
                            type="submit"
                            variant="contained"
                            fullWidth
                            disabled={!email.trim() || !password.trim() || isSubmitting}
                        >
                            {isSubmitting ? 'Creating account...' : 'Create account'}
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>

            {/* Sign In Modal */}
            <Dialog open={showSignInModal} onClose={closeSignInPopup} maxWidth="xs" fullWidth>
                <DialogTitle>{emailSubmitted ? 'Enter your password' : 'Sign In'}</DialogTitle>
                <DialogContent>
                    {emailSubmitted ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                            <TextField 
                                type="text" 
                                value={email} 
                                disabled 
                                fullWidth
                                label="Email"
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
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSignInWithEmail();
                                    }
                                }}
                            />
                            {errorMessage && (
                                <Alert severity="error">
                                    {errorMessage.includes('to resend the verification email') ? (
                                        <>
                                            Please verify your email.{' '}
                                            <Link component="button" onClick={resendVerificationEmail}>
                                                Click here
                                            </Link>
                                            {' '}to resend the verification email.
                                        </>
                                    ) : errorMessage.includes('to reset your password') ? (
                                        <>
                                            The password you entered is incorrect.{' '}
                                            <Link component="button" onClick={openForgotPasswordPopup}>
                                                Click here
                                            </Link>
                                            {' '}to reset your password.
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
                                disabled={!password.trim()}
                            >
                                Log in
                            </Button>
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                            <TextField
                                type="email"
                                label="Email"
                                required
                                fullWidth
                                value={email}
                                onChange={handleEmailChange}
                                onKeyDown={handleEmailChange}
                            />
                            {errorMessage && !emailSubmitted && (
                                <Alert severity="error">{errorMessage}</Alert>
                            )}
                            <Button
                                onClick={handleNextClick}
                                variant="contained"
                                fullWidth
                                disabled={!isEmailValid || !!errorMessage}
                            >
                                Next
                            </Button>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Typography variant="body2" sx={{ mr: 'auto' }}>
                        Don't have an account?{' '}
                        <Link component="button" onClick={toggleForm}>
                            Sign up
                        </Link>
                    </Typography>
                </DialogActions>
            </Dialog>

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
                            onChange={(e) => setRecoveryEmail(e.target.value)}
                            required
                        />
                        {errorMessage && (
                            <Alert severity="error">{errorMessage}</Alert>
                        )}
                        <Button type="submit" variant="contained" fullWidth>
                            Send reset email
                        </Button>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={backToSignInPopup}>Back</Button>
                </DialogActions>
            </Dialog>

            {/* Consent Modal */}
            <Dialog open={showConsentModal} onClose={declineConsent} maxWidth="sm" fullWidth>
                <DialogTitle>Your Privacy Matters</DialogTitle>
                <DialogContent dividers>
                    <Typography gutterBottom>
                        To enhance your experience and create your account, we securely store your email and interaction history. By clicking 'Agree', you acknowledge and consent to this use.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={acceptConsent} variant="contained" color="primary">
                        Agree
                    </Button>
                    <Button onClick={declineConsent} variant="outlined" color="secondary">
                        Decline
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default CustomLoginForm;