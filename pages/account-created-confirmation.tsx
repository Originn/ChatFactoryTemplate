import React from 'react';
import styles from '@/styles/PasswordResetConfirmation.module.css';
import Image from 'next/image';

const AccountCreatedConfirmation: React.FC = () => {
  const scimageIcon = process.env.NODE_ENV === 'production'
    ? 'https://solidcam.herokuapp.com/solidcam.png'
    : '/solidcam.png';

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
      <h1 className={styles.header}>Account Successfully Created</h1>
      <p className={styles.paragraph}>
        Your email has been verified, and your account has been successfully created.
      </p>
      <p className={styles.paragraph}>
        You can now log in to your account using the link below:
      </p>
      <p className={styles.paragraph}>
        <a 
          href="https://www.solidcamchat.com/" 
          style={{ color: '#0070f3', textDecoration: 'underline', cursor: 'pointer' }}
        >
          Go to SolidCAM Chat Login
        </a>
      </p>
    </div>
  );
}

export default AccountCreatedConfirmation;
