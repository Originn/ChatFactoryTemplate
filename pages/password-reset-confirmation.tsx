// pages/password-reset-confirmation.tsx
import styles from '@/styles/PasswordResetConfirmation.module.css';
import Image from 'next/image';

export default function PasswordResetConfirmation() {
  return (
    <div className={styles.passwordResetContainer}>
      <div className={styles.imageContainer}>
        <Image 
          src='/solidcam.png'  // Adjust the path to your actual image
          alt="SolidCAM Logo"
          width={100}  // Adjust based on your actual image dimensions
          height={100}  // Adjust based on your actual image dimensions
          className={styles.image}
        />
      </div>
      <h1 className={styles.header}>Reset Your Password</h1>
      <p className={styles.paragraph}>
        We&apos;ve sent a link to your email address. Please check your inbox and follow the instructions to reset your password.
      </p>
      <p className={styles.paragraph}>
        If you don&apos;t see the email, please check your spam or junk mail folder.
      </p>
    </div>
  );
}
