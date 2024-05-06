// auth/CustomLoginForm.tsx
import React, { useState, useEffect, useRef } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, OAuthProvider, fetchSignInMethodsForEmail, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from 'utils/firebase';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Cookies from 'js-cookie';

const CustomLoginForm = () => {
    // Removed the name state since it's not needed anymore
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showModal, setShowModal] = useState(false); // State to control modal visibility
    const [showSignInModal, setShowSignInModal] = useState(false);
    const [isSignIn, setIsSignIn] = useState(false);
    const [emailSubmitted, setEmailSubmitted] = useState(false);
    const [isEmailValid, setIsEmailValid] = useState(false);
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [theme, setTheme] = useState('light');
    const [consentGiven, setConsentGiven] = useState(false);
    const [showConsentModal, setShowConsentModal] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    const router = useRouter();

    useEffect(() => {
        document.body.className = theme;
    }, [theme]);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme); // Save theme preference
    };

    const baseURL = process.env.NODE_ENV === 'production' ? 'https://solidcam.herokuapp.com/' : '/';
    

    // Use the base URL with your image path
    const moonIcon = `${baseURL}icons8-moon-50.png`;

    // Determine which icon to show based on the current theme
    const iconPath = theme === 'light' ? moonIcon : "/icons8-sun.svg";
    const buttonBgClass = theme === 'dark' ? "bg-white" : "bg-gray-600";

    const handleSignInWithEmail = async () => {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (userCredential.user.emailVerified) {
          router.push('/'); // Redirect to home page or dashboard
        } else {
          // User is signed in but the email is not verified
          setErrorMessage('Your email is not verified. Please check your inbox or click here to resend the verification email.');
        }
      } catch (error : any) {
        console.error('Error during email sign-in:', error);
        switch (error.code) {
          case 'auth/wrong-password':
            // Incorrect password error
            setErrorMessage('The password you entered is incorrect. Click here to reset your password.');
            break;
          case 'auth/user-not-found':
            setErrorMessage('No account found with this email. Please sign up.');
            break;
          case 'auth/too-many-requests':
            // Handle the too many requests error specifically, suggest resetting password
            setErrorMessage('We have detected too many requests from your device. It seems you might have forgotten your password. Click here to reset your password, or please wait a while then try again.');
            break;
          default:
            setErrorMessage('An error occurred during sign in. Please try again later.');
        }
      }
    };
    
    const resendVerificationEmail = async () => {
      if (auth.currentUser) {  // Check if currentUser is not null
          try {
              await sendEmailVerification(auth.currentUser);
              router.push('/verification-sent'); // Redirect to the verification sent page
          } catch (error) {
              console.error('Error resending verification email:', error);
              setErrorMessage('Failed to resend verification email. Please try again later.');
          }
      } else {
          setErrorMessage('No user is signed in to resend verification to.'); // Handle case where no user is logged in
      }
  };

    // const signInWithMicrosoft = async () => {
    //     // Pre-attempt log: you might want to log the current state before attempting to sign in.
    //     console.log(`Attempting to sign in with Microsoft. Current email: ${email}`);
      
    //     try {
    //       const provider = new OAuthProvider('microsoft.com');
    //       provider.addScope('User.Read');
    //       provider.setCustomParameters({
    //         prompt: 'select_account',
    //       });
      
    //       // Logging the custom parameters to verify if they are set correctly.
    //       //console.log('Custom Parameters set for Microsoft provider:', provider.setCustomParameters);
      
    //       const result = await signInWithPopup(auth, provider);
    //       // Success log
    //       //console.log('Successfully signed in with Microsoft:', result);
      
    //       router.push('/'); // Redirect on successful sign in
    //     } catch (error : any) {
    //       // Error log: capture and log the complete error object
    //       console.error('Error during Microsoft sign-in:', error);
          
    //       // Depending on the error, it could be related to the company mail configuration
    //       if (error.email && error.email === email) {
    //         console.error(`Sign-in failed for company email ${email}.`, error);
    //       } else {
    //         console.error('Sign-in failed for an unknown reason.', error);
    //       }
      
    //       // Set error message for UI. You might want to handle sensitive error info differently.
    //       setErrorMessage(`Error during sign-in with Microsoft: ${error.message}`);
    //     }
    //   };

      const signInWithGoogle = async () => {
        try {
          const provider = new GoogleAuthProvider();
          await signInWithPopup(auth, provider);
          router.push('/'); // Redirect on successful sign in
        } catch (error) {
          console.error('Error during Google sign-in:', error);
          setErrorMessage('Failed to sign in with Google. Please try again.');
        }
      };

      const signInWithApple = async () => {
        try {
          const provider = new OAuthProvider('apple.com');
          await signInWithPopup(auth, provider);
          router.push('/'); // Redirect on successful sign in
        } catch (error) {
          console.error('Error during Apple sign-in:', error);
          setErrorMessage('Failed to sign in with Apple. Please try again.');
        }
      };

      const createAccountWithEmail = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsSubmitting(true); // Indicate that submission has started
        setErrorMessage(''); // Clear any existing error messages
      
        if (selectedProvider) {
            // If a provider is selected, handle the provider sign up
            acceptConsent();
        } else {
            // If no provider is selected, proceed with email/password registration
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, email, password);
              await sendEmailVerification(userCredential.user);
              router.push('/verification-sent');
            } catch (error: any) {
                if (error.code === 'auth/email-already-in-use') {
                    setErrorMessage('The email address is already in use by another account.');
                } else {
                    // Error message formatting can be improved as needed
                    const formattedError = error.message.replace('Firebase: ', '');
                    setErrorMessage(formattedError);
                }
            } finally {
                setIsSubmitting(false); // Indicate that submission has ended
            }
        }
    };
const backToSignInPopup = () => {
  setShowForgotPasswordModal(false); // Close the Forgot Password popup
  setShowSignInModal(true); // Open the Sign In popup
};

const isFormValid = () => {
  // Check if email and password are not empty and also check for consent if a provider is selected.
  return email.trim() && password.trim() && (!selectedProvider || consentGiven);
};

const toggleForm = () => {
    setIsSignIn(!isSignIn); // Toggle between sign in and sign up
  };

  const handleNextClick = async () => {
    if (!validateEmail(email)) {
        setErrorMessage('Please enter a valid email address.');
        return;
    }

    try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods.length === 0) {
            setErrorMessage('No account found with this email. Please sign up.');
        } else {
            setEmailSubmitted(true); // This state change triggers the useEffect
            setErrorMessage('');
        }
    } catch (error) {
        console.error('Error checking user email:', error);
        setErrorMessage('An error occurred while checking the email.');
    }
};

useEffect(() => {
    // Automatically focus the password input when the email has been submitted
    if (emailSubmitted && passwordInputRef.current) {
        passwordInputRef.current.focus();
    }
}, [emailSubmitted]); // Depend on emailSubmitted to trigger the focus

  
  
  const validateEmail = (email : any) => {
    // Simple regex for email validation
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
  
    // Check if Enter key is pressed
    if (e.key === 'Enter' && isValid && !errorMessage) {
      e.preventDefault(); // Prevent the default form submit
      handleNextClick(); // Programmatically trigger the next button click
    }
  };

  

  const openPopup = () => setShowModal(true);
  const closePopup = () => setShowModal(false);


  const openSignInPopup = () => {
    setEmail(''); // Clear the email field
    setPassword(''); // Clear the password field, if you also want to clear this
    setErrorMessage(''); // Clear any error messages
    setShowSignInModal(true); // Open the sign-in popup
  };
  const closeSignInPopup = () => {
    setShowSignInModal(false);
    setEmail(''); // Clear the email field
    setEmailSubmitted(false); // Reset to initial state
    setIsEmailValid(false); // Reset email validity
    setErrorMessage(''); // Clear any error messages
  };

  const openForgotPasswordPopup = () => {
    closeAllPopups(); // Close all other popups first
    setErrorMessage(''); // Clear any existing error messages
    setRecoveryEmail(email); // Set the recovery email to the currently entered email
    setShowForgotPasswordModal(true); // Open the Forgot Password popup
};
  
  const closeForgotPasswordPopup = () => {
    setShowForgotPasswordModal(false); // Close the forgot password popup
  };

  const sendPasswordReset = async () => {
    if (!validateEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      // Show message to check their email
      setErrorMessage('Check your email for a link to reset your password.');
    } catch (error) {
      console.error('Error sending password reset email:', error);
      setErrorMessage('Failed to send password reset email. Please try again.');
    }
  };

  const closeAllPopups = () => {
    closeSignInPopup();
    closeForgotPasswordPopup();
  };

  const handleSendPasswordResetEmail = async (e: any) => {
    e.preventDefault();
    if (!validateEmail(recoveryEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
  
    try {
      await sendPasswordResetEmail(auth, recoveryEmail);
      // Redirect to the password reset confirmation page after successful email send
      router.push('/password-reset-confirmation');
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      setErrorMessage("Failed to send password reset email. Please try again later.");
      // Optionally, you can handle different types of errors differently
    }
  };



  const darkModeStyle = theme === 'dark' ? { color: 'lightblue', textDecoration: 'underline', cursor: 'pointer' } : { color: 'blue', textDecoration: 'underline', cursor: 'pointer' };
  
  const handleProviderSignUp = (provider: any) => {
    setSelectedProvider(provider);
    
    // Check consent before showing the modal
    const consentCookie = Cookies.get('userConsent');
    if (consentCookie === 'true') {
      proceedWithProviderSignIn(provider);
    } else {
      setShowConsentModal(true);
    }
  };

  const proceedWithProviderSignIn = (provider: string | null) => {
    if (!provider) {
      console.error("Provider is null, cannot proceed with sign-in.");
      return; // Optionally add more handling logic here.
    }
  
    if (provider === 'google') {
      signInWithGoogle();
    } else if (provider === 'apple') {
      signInWithApple();
    }
  };


const ConsentModal = () => (
  <div className="backdropStyle">
  <div className="modalStyle">
      <h2 className="headerStyle">Your Privacy Matters</h2>
          <p>To enhance your experience, we securely store your email and interaction history. By agreeing, you acknowledge and consent to this use.</p>
          <div style={{ margin: '20px 0' }}>
              <input
                  type="checkbox"
                  id="user-consent-checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  style={{ marginRight: '10px' }}
              />
              <label htmlFor="user-consent-checkbox">I agree</label>
          </div>
          <button onClick={acceptConsent} className="agreeButtonStyle" disabled={!consentGiven}>
                    Agree
                </button>
                <button onClick={() => setShowConsentModal(false)} className="cancelButtonStyle">
                    Cancel
                </button>
            </div>
        </div>
    );
  
  
    const acceptConsent = () => {
      setShowConsentModal(false);
      setConsentGiven(true);
      Cookies.set('userConsent', 'true', { expires: 365 }); // Set a cookie for 1 year
    
      if (selectedProvider) {
        proceedWithProviderSignIn(selectedProvider);
      } else {
        console.error("No provider selected, cannot proceed with sign-in.");
      }
    };

  useEffect(() => {
    document.body.className = theme;
  
    // Check if consent has already been given when the component mounts
    const consentCookie = Cookies.get('userConsent');
    if (consentCookie === 'true') {
      setConsentGiven(true);
    }
  }, []);
  

    const handleCreateAccountClick = () => {
      if (isFormValid() && !isSubmitting) {
          if (!consentGiven) {
              setShowConsentModal(true);  // Only show the consent modal
          } else {
              createAccountWithEmail();  // If already consented, proceed to create account
          }
      }
  };

  return (
    <>
        <Head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            {/* other head elements */}
        </Head>
        <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
          <button onClick={toggleTheme} className="toggle-theme-button">
          <div className={`${buttonBgClass} p-2 rounded-full`}>
            <Image src={iconPath} alt={theme === 'dark' ? 'Light mode icon' : 'Light mode icon'} width={24} height={24} />
          </div>
          </button>
        </div>
        <div className="center-wrapper">
            <div className="image-container">
                <img src="/solidcam.png" alt="SolidCAM Logo"/>
            </div>
            <div className="firebaseui-container">
                <div className="firebaseui-card-content">
                    <div className="heading">Let's Chat!</div>
                    <button onClick={() => handleProviderSignUp('google')} className="firebaseui-idp-button firebaseui-idp-google">
                      <span className="firebaseui-idp-icon-wrapper">
                        <img className="firebaseui-idp-icon" src="/google.svg" alt="Google" />
                      </span>
                      <span className="firebaseui-idp-text">Sign in with Google</span>
                    </button>
                    <button onClick={() => handleProviderSignUp('apple')} className="firebaseui-idp-button firebaseui-idp-apple">
                      <span className="firebaseui-idp-icon-wrapper">
                        <img className="firebaseui-idp-icon" src="/apple.svg" alt="Apple" />
                      </span>
                      <span className="firebaseui-idp-text">Sign in with Apple</span>
                    </button>
                    {/* <button onClick={signInWithMicrosoft} className="firebaseui-idp-button firebaseui-idp-microsoft">
                        <span className="firebaseui-idp-icon-wrapper">
                            <img className="firebaseui-idp-icon" src="/microsoft.svg" alt="Microsoft" />
                        </span>
                        <span className="firebaseui-idp-text">Sign up with Microsoft</span>
                    </button> */}
                    <div className="divider-container">
                        <div className="divider">or</div>
                    </div>
                    <button onClick={openPopup} className="create-account-button">Create account</button>
                    <div className="account-exists-text">Already have an account?</div>
                    <button
                        onClick={openSignInPopup} // Update this line
                        className="btn sign-in-button"
                    >
                        Sign in with Email
                    </button>
                    {showModal && (
                        <div className="signup-popup-backdrop">
                            <div className="signup-popup">
                                <div className="signup-popup-header">
                                    <button onClick={closePopup} className="signup-popup-close">&times;</button>
                                    <h2>Create Your Account</h2>
                                </div>
                                <form onSubmit={createAccountWithEmail} className="signup-popup-body">
                                  <input
                                    type="email"
                                    placeholder="Email"
                                    required
                                    value={email}
                                    onChange={(e) => {
                                      setEmail(e.target.value);
                                      setErrorMessage('');
                                    }}
                                    className="signup-popup-body-input"
                                    onKeyDown={(e) => e.key === 'Enter' && isFormValid() && createAccountWithEmail(e)}
                                  />
                                  <input
                                    type="password"
                                    placeholder="Password"
                                    required
                                    value={password}
                                    onChange={(e) => {
                                      setPassword(e.target.value);
                                      setErrorMessage('');
                                    }}
                                    className="signup-popup-body-input"
                                    ref={passwordInputRef}
                                    onKeyDown={(e) => e.key === 'Enter' && isFormValid() && createAccountWithEmail(e)}
                                  />
                                  {errorMessage && <div className="error-message">{errorMessage}</div>}
                                  <button
                                    type="submit"  // This makes the button the default submitter of the form
                                    className={`btn ${isFormValid() && !isSubmitting ? 'btn-enabled' : ''}`}
                                    disabled={!isFormValid() || isSubmitting}
                                  >
                                    Create account
                                  </button>
                                </form>
                            </div>
                        </div>
                    )}
                    {showSignInModal && (
                    <div className="signin-popup-backdrop">
                        <div className="signin-popup">
                            <div className="signin-popup-header">
                                <button onClick={closeSignInPopup} className="signin-popup-close">&times;</button>
                                <h2>{emailSubmitted ? "Enter your password" : "Sign In"}</h2>
                            </div>
                            <div className="signin-popup-body">
                                {emailSubmitted ? (
                                    <>
                                        <input
                                            type="text"
                                            value={email}
                                            className="signin-popup-body-input"
                                            disabled
                                        />
                                        <input
                                            type="password"
                                            placeholder="Password"
                                            required
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value);
                                                setErrorMessage(''); // Clear the error when the user starts typing
                                            }}
                                            ref={passwordInputRef}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault(); // Prevent the default action to avoid submitting the form
                                                    handleSignInWithEmail();
                                                }
                                            }}
                                            className="signin-popup-body-input"
                                        />
                                      {errorMessage && (
                                        <div className="error-message">
                                          {errorMessage.includes('to resend the verification email') ? (
                                            <>
                                              Please verify your email.{' '}
                                              <span onClick={resendVerificationEmail} style={darkModeStyle}>
                                                Click here
                                              </span>
                                              {' '}to resend the verification email.
                                            </>
                                          ) : errorMessage.includes('to reset your password') ? (
                                            <>
                                              The password you entered is incorrect.{' '}
                                              <span onClick={openForgotPasswordPopup} style={darkModeStyle}>
                                                Click here
                                              </span>
                                              {' '}to reset your password.
                                            </>
                                          ) : (
                                            errorMessage
                                          )}
                                        </div>
                                      )}
                                        <button
                                            onClick={handleSignInWithEmail}
                                            className="btn sign-in-next-button"
                                            disabled={!password.trim()}
                                        >
                                            Log in
                                        </button>
                                    </>
                                ) : (
                                    // Logic for the initial email input should go here if emailSubmitted is false
                                    <>
                                        <input
                                            type="email"
                                            placeholder="Email"
                                            required
                                            value={email}
                                            onChange={handleEmailChange}
                                            onKeyDown={handleEmailChange}
                                            className="signin-popup-body-input"
                                        />
                                        {errorMessage && !emailSubmitted && (
                                        <div className="error-message">{errorMessage}</div>
                                      )}
                                      <button
                                        onClick={handleNextClick}
                                        className="btn sign-in-next-button"
                                        disabled={!isEmailValid || !!errorMessage}
                                      >
                                        Next
                                      </button>
                                    </>
                                  )}
                            </div>
                            <div className="signin-popup-footer">
                                Don't have an account? <a href="#" className="create-account-link" onClick={toggleForm}>Sign up</a>
                            </div>
                        </div>
                    </div>
                )}
                    {showForgotPasswordModal && (
                      <div className="forgot-password-popup-backdrop">
                          <div className="forgot-password-popup">
                              <div className="forgot-password-popup-header">
                                  <h2>Reset Your Password</h2>
                                  <button onClick={closeForgotPasswordPopup} className="forgot-password-popup-close">×</button>
                                  <button onClick={backToSignInPopup} className="back-to-sign-in-button" style={{ position: 'absolute', left: '10px', top: '10px' }}>
                                      ← Back
                                  </button>
                              </div>
                              <div className="forgot-password-popup-body">
                                  <form onSubmit={handleSendPasswordResetEmail}>
                                      <input
                                          type="email"
                                          placeholder="Enter your email"
                                          value={recoveryEmail} // Use recoveryEmail state here
                                          onChange={(e) => setRecoveryEmail(e.target.value)}
                                          required
                                      />
                                      {errorMessage && <div className="error-message">{errorMessage}</div>}
                                      <button type="submit" className="btn forgot-password-next-button">
                                          Send reset email
                                      </button>
                                  </form>
                              </div>
                          </div>
                      </div>
                  )}
                </div>
            </div>
        </div>
        {showConsentModal && <ConsentModal />}
    </>
);

   };

export default CustomLoginForm;