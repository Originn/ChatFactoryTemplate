import React from 'react';
import styles from '@/styles/PasswordResetConfirmation.module.css';
import Image from 'next/image';
import { useRouter } from 'next/router';

const VerificationFailed: React.FC = () => {
  const router = useRouter();
  const { email } = router.query;

  const scimageIcon = process.env.NODE_ENV === 'production'
    ? 'https://solidcam.herokuapp.com/solidcam.png'
    : '/solidcam.png';

  const handleResendVerification = () => {
    if (email) {
      // Example: Make an API call or use Firebase to resend the verification email
      console.log(`Resending verification email to ${email}`);
      alert(`A new verification email has been sent to ${email}.`);
      // Optionally, you could also redirect the user or provide further feedback
    }
  };

  return (
    <div className={styles.passwordResetContainer}>
      <div className={styles.imageContainer}>
        <Image 
          src={scimageIcon}
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
