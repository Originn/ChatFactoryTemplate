
import Image from 'next/image';
import styles from '@/styles/VerificationSent.module.css';
import solidcamImage from '../public/solidcam.png';

export default function VerificationSent() {
  return (
    <div className={styles.verificationSentContainer}>
      <div className={styles.imageContainer}>
        {/* Next.js Image component for optimized image loading */}
        <Image 
          src={solidcamImage} // Replace with your actual image path
          alt="solidcam"
          width={100} // Adjust to the size of your actual image
          height={100} // Adjust to the size of your actual image
          className={styles.image}
        />
      </div>
      <h1 className={styles.header}>Check Your Email</h1>
      <p className={styles.paragraph}>
        We&apos;ve sent an email to the address you provided. Please click on the verification link in the email to complete your registration.
      </p>
    </div>
  );
}
