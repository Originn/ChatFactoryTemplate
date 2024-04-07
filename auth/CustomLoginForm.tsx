// auth/CustomLoginForm.tsx
import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, OAuthProvider, fetchSignInMethodsForEmail, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from 'utils/firebase';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';

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
          // Check if the user has verified their email
          if (userCredential.user.emailVerified) {
            // Email is verified, proceed to redirect
            router.push('/'); // Redirect to home page or dashboard
          } else {
            // Email is not verified, alert the user or handle accordingly
            setErrorMessage('Please verify your email before signing in.');
            // Consider signing out the user if they haven't verified their email
            // await signOut(auth);
          }
        } catch (error : any) {
            console.error('Error during email sign-in:', error);
            let errorMsg = '';
            if (error.code === 'auth/wrong-password') {
                errorMsg = 'The password you entered is incorrect. Please try again.';
            } else if (error.code === 'auth/user-not-found') {
                errorMsg = 'No account found with this email. Please sign up.';
            } else {
                errorMsg = 'An error occurred during sign in. Please try again later.';
            }
            setErrorMessage(errorMsg);
        }
    };

    const signInWithMicrosoft = async () => {
        // Pre-attempt log: you might want to log the current state before attempting to sign in.
        console.log(`Attempting to sign in with Microsoft. Current email: ${email}`);
      
        try {
          const provider = new OAuthProvider('microsoft.com');
          provider.addScope('User.Read');
          provider.setCustomParameters({
            prompt: 'select_account',
          });
      
          // Logging the custom parameters to verify if they are set correctly.
          console.log('Custom Parameters set for Microsoft provider:', provider.setCustomParameters);
      
          const result = await signInWithPopup(auth, provider);
          // Success log
          console.log('Successfully signed in with Microsoft:', result);
      
          router.push('/'); // Redirect on successful sign in
        } catch (error : any) {
          // Error log: capture and log the complete error object
          console.error('Error during Microsoft sign-in:', error);
          
          // Depending on the error, it could be related to the company mail configuration
          if (error.email && error.email === email) {
            console.error(`Sign-in failed for company email ${email}.`, error);
          } else {
            console.error('Sign-in failed for an unknown reason.', error);
          }
      
          // Set error message for UI. You might want to handle sensitive error info differently.
          setErrorMessage(`Error during sign-in with Microsoft: ${error.message}`);
        }
      };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // Redirect after sign in
      router.push('/');
    } catch (error) {
      console.error('Error during Google sign-in:', error);
      // Handle the error here
    }
  };

  const signInWithApple = async () => {
    try {
      const provider = new OAuthProvider('apple.com');
      const result = await signInWithPopup(auth, provider);
  
      // After successful sign-in with Apple, check if the user needs to be redirected.
      // This could involve checking the result for specific conditions that indicate success.
      // For example, if you're linking accounts and want to wait for that process to complete,
      // make sure any asynchronous operations related to account linking are awaited here.
      
      // Assuming all conditions are met, proceed to redirect the user.
      console.log('Successfully signed in with Apple:', result);
      router.push('/'); // Redirect on successful sign in
    } catch (error : any) {
      console.error('Error during Apple sign-in:', error);
      setErrorMessage(error.message); // Display the error message to the user
      
      // Depending on the error, you may want to handle specific cases differently.
      // For example, if account linking is required but fails, you might choose a different response or error message.
    }
  };
  const createAccountWithEmail = async (e : any) => {
    e.preventDefault();
    setIsSubmitting(true); // Indicate that submission has started
    setErrorMessage(''); // Clear any existing error messages

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Send verification email after account creation
        await sendEmailVerification(userCredential.user);
        router.push('/verification-sent');
    } catch (error : any) {
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
};

const isFormValid = () => {
    // Add your logic to check if the form is valid
    return email.trim() && password.trim();
};
const toggleForm = () => {
    setIsSignIn(!isSignIn); // Toggle between sign in and sign up
  };

  const handleNextClick = async () => {
    // Validate email format
    if (!validateEmail(email)) {
      // If the email format is invalid, set an error message
      setErrorMessage('Please enter a valid email address.');
      return;
    }
  
    // Check if the email exists in Firebase datastore
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods.length === 0) {
        // No user found with this email address
        setErrorMessage('No account found with this email. Please sign up.');
      } else {
        // Email exists, user can enter the password
        setEmailSubmitted(true);
        setErrorMessage(''); // Clear any previous error messages
      }
    } catch (error) {
      console.error('Error checking user email:', error);
      setErrorMessage('An error occurred while checking the email.');
    }
  };
  
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
    closeAllPopups(); // Close sign-in and forgot password pop-ups
    setErrorMessage(''); // Clear any error messages
    setShowForgotPasswordModal(true); // Open the forgot password popup
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

  const handleSendPasswordResetEmail = async (e : any) => {
    e.preventDefault(); // Prevent default form submission behavior
    if (!recoveryEmail) {
      // Optionally, validate the email before attempting to send a reset email
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, recoveryEmail);
      setErrorMessage(""); // Clear any existing error messages
      postMessage("A password reset link has been sent to your email address. Please check your inbox."); // Inform the user
      closeForgotPasswordPopup(); // Close the popup
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      setErrorMessage("Failed to send password reset email. Please try again later.");
    }
  };

  
  
  return (
    <>
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      {/* other head elements */}
    </Head>
    <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                <button onClick={toggleTheme} style={{ border: 'none', background: 'none' }}>
                    <div className={`${buttonBgClass} p-2 rounded-full`}>
                        <Image src={iconPath} alt={theme === 'dark' ? 'Light mode icon' : 'Dark mode icon'} width={24} height={24} />
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
        <button onClick={signInWithGoogle} className="firebaseui-idp-button firebaseui-idp-google">
          <span className="firebaseui-idp-icon-wrapper">
            <img className="firebaseui-idp-icon" src="/google.svg" alt="Google" />
          </span>
          <span className="firebaseui-idp-text">Sign up with Google</span>
        </button>
        <button onClick={signInWithApple} className="firebaseui-idp-button firebaseui-idp-apple">
          <span className="firebaseui-idp-icon-wrapper">
            <img className="firebaseui-idp-icon" src="/apple.svg" alt="Apple" />
          </span>
          <span className="firebaseui-idp-text">Sign up with Apple</span>
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
            Sign in
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
                        setErrorMessage(''); // Clear the error when the user starts typing
                    }}
                    className="signup-popup-body-input"
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
                    className="signup-popup-body-input"
                />
                <div className="signup-popup-footer">
                {errorMessage && <div className="error-message">{errorMessage}</div>}
                <button
                    type="submit"
                    className={`btn ${!isFormValid() || isSubmitting ? '' : 'btn-enabled'}`}
                    disabled={!isFormValid() || isSubmitting}
                >
                    Create account
                </button>
                </div>
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
                // When email is submitted, ask for the password
                <>
                <input
                type="text"
                value={email}
                className="signin-popup-body-input"
                disabled
                style={{ background: '#f7f7f7', color: '#999' }} // Inline style for gray text and background
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
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent the default action to avoid submitting the form if inside one
                    // Trigger the login function directly or click the Log in button programmatically
                    handleSignInWithEmail();
                    }
                }}
                className="signin-popup-body-input"
                />
                {errorMessage && (
                    <div className="error-message">{errorMessage}</div>
                )}
                    <button
                    onClick={handleSignInWithEmail} // Call the function to handle email and password submission
                    className="btn sign-in-next-button"
                    disabled={!password.trim()} // Disable the button until a valid password is entered
                    >
                    Log in
                    </button>
                </>
                ) : (
                // Initially, ask for the email
                <>
                    <button onClick={signInWithGoogle} className="firebaseui-idp-button firebaseui-idp-google">
                    <span className="firebaseui-idp-icon-wrapper">
                        <img className="firebaseui-idp-icon" src="/google.svg" alt="Google" />
                    </span>
                    <span className="firebaseui-idp-text">Sign in with Google</span>
                    </button>
                    <button onClick={signInWithApple} className="firebaseui-idp-button firebaseui-idp-apple">
                    <span className="firebaseui-idp-icon-wrapper">
                        <img className="firebaseui-idp-icon" src="/apple.svg" alt="Apple" />
                    </span>
                    <span className="firebaseui-idp-text">Sign in with Apple</span>
                    </button>
                    <button onClick={signInWithMicrosoft} className="firebaseui-idp-button firebaseui-idp-microsoft">
                    <span className="firebaseui-idp-icon-wrapper">
                        <img className="firebaseui-idp-icon" src="/microsoft.svg" alt="Microsoft" />
                    </span>
                    <span className="firebaseui-idp-text">Sign in with Microsoft</span>
                    </button>
                    <div className="divider-container">
                    <div className="divider">or</div>
                    </div>
                    <input
                    type="email"
                    placeholder="Email"
                    required
                    value={email}
                    onChange={handleEmailChange} // Attach the handleEmailChange here
                    onKeyDown={handleEmailChange} // Also attach to the onKeyDown event
                    className="signin-popup-body-input"
                    />
                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                    <button
                    onClick={handleNextClick}
                    className="btn sign-in-next-button"
                    disabled={!isEmailValid || !!errorMessage}
                    >
                    Next
                    </button>
                </>
                )}
                <a href="#" className="forgot-password-link" onClick={openForgotPasswordPopup}>
                Forgot password?
                </a>
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
                <button onClick={closeForgotPasswordPopup} className="forgot-password-popup-close">&times;</button>
            </div>
            <div className="forgot-password-popup-body">
                <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                />
                {errorMessage && <div className="error-message">{errorMessage}</div>}
                <button onClick={sendPasswordReset} className="btn forgot-password-next-button">
                Send reset email
                </button>
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
            </div>
            <div className="forgot-password-popup-body">
                <form onSubmit={handleSendPasswordResetEmail}>
                <input
                    type="email"
                    placeholder="Enter your email"
                    value={recoveryEmail}
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
    </>
    );
   };

export default CustomLoginForm;