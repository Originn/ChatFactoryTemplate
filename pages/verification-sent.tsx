import React from 'react';
import styles from '@/styles/VerificationSent.module.css';
import Image from 'next/image'

const VerificationSent: React.FC = () => {
  return (
    <div className={styles.verificationSentContainer}>
      <div className={styles.imageContainer}>
        <Image 
          src="/solidcam.png"
          alt="SolidCAM Logo"
          width={100}
          height={100}
          className={styles.image}
        />
      </div>
      <h1 className={styles.header}>Check Your Email</h1>
      <p className={styles.paragraph}>
        We've sent an email to the address you provided. Please click on the verification link in the email to complete your registration.
      </p>
      <p className={styles.paragraph}>
        If you don't see our email shortly, please check your junk or spam folder.
      </p>
    </div>
  );
}

export default VerificationSent;