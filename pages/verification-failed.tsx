import React, { useEffect, useState } from 'react';
import styles from '@/styles/PasswordResetConfirmation.module.css';
import Image from 'next/image';
import { useRouter } from 'next/router';

const VerificationFailed: React.FC = () => {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Retrieve the email from sessionStorage
    const storedEmail = sessionStorage.getItem('verificationFailedEmail');
    if (storedEmail) {
      setEmail(storedEmail);
    } else {
      // If no email is found, redirect to the homepage or handle appropriately
      router.replace('/');
    }
  }, [router]);

  const handleResendVerification = () => {
    if (email) {
      // Example: Make an API call or use Firebase to resend the verification email
      console.log(`Resending verification email to ${email}`);
      alert(`A new verification email has been sent to ${email}.`);
    }
  };

  return (
    <div className={styles.passwordResetContainer}>
      <div className={styles.imageContainer}>
        <Image 
          src={process.env.NODE_ENV === 'production' 
              ? 'https://solidcam.herokuapp.com/solidcam.png' 
              : '/solidcam.png'}
          alt="SolidCAM Logo"
          width={100}
          height={100}
          className={styles.image}
        />
      </div>
      <h1 className={styles.header}>Verification Failed</h1>
      <p className={styles.paragraph}>
        It seems that your email verification link has expired or is invalid.
      </p>
      <p className={styles.paragraph}>
        Please click the button below to send a new verification email to {email}.
      </p>
      <button 
        onClick={handleResendVerification}
        style={{ color: '#fff', backgroundColor: '#0070f3', padding: '10px 20px', border: 'none', cursor: 'pointer', borderRadius: '5px', marginTop: '20px' }}
      >
        Resend Verification Email
      </button>
    </div>
  );
}

export default VerificationFailed;
