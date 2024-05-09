// pages/privacy-policy.tsx
import Image from 'next/image';
import styles from '@/styles/PrivacyPolicy.module.css';
import Link from 'next/link';

const PRODUCTION_ENV = 'production';
const PRODUCTION_URL = 'https://solidcam.herokuapp.com/';

// Image URL
let scimageIcon = '/solidcam.png';

if (process.env.NODE_ENV === PRODUCTION_ENV) {
    scimageIcon = `${PRODUCTION_URL}solidcam.png`;
}

export default function PrivacyPolicy() {
  return (
    <div className={styles.privacyContainer}>
      <div className={styles.imageContainer}>
      <Link href="/">
            <Image 
              src={scimageIcon}
              alt="SolidCAM Logo"
              width={100}
              height={100}
              className={styles.image}
            />
        </Link>
      </div>
      <div className={`${styles.privacyPolicyTextContainer} ${styles.textContainer}`}>
      <h1 className={styles.header}>Privacy Policy for SolidCAM ChatBot</h1>
      <h2 className={styles.subHeader}>Effective Date: 5th May 2024</h2>
      <p className={styles.paragraph}>
        SolidCAM ChatBot utilizes leading-edge language learning models (LLMs) to provide responsive and accurate answers to users&apos; inquiries regarding SolidCAM software. This document outlines our commitment to your privacy and details the measures we take to protect the personal information you share with us while interacting with our service.
      </p>

      <h3 className={styles.sectionHeader}>Information Collection</h3>
      <p className={styles.paragraph}>
        <strong>Personal Data Collection:</strong> We collect personal data that includes your email address, which facilitates communication and personalization of our service. Additionally, we log the queries you submit and the corresponding responses provided by the ChatBot to refine and enhance the accuracy of our tool.
      </p>
      <p className={styles.paragraph}>
        <strong>Interaction Logs:</strong> Every interaction with our ChatBot, including the timestamp of each session, is meticulously logged to help improve response relevance and timeliness.
      </p>
      <p className={styles.paragraph}>
        <strong>Comments and Feedback:</strong> We actively collect user feedback submitted through our platform. This input is invaluable as it helps us to continually refine our offerings and address user needs more effectively.
      </p>

      <h3 className={styles.sectionHeader}>Use of Information</h3>
      <p className={styles.paragraph}>
        <strong>Service Improvement:</strong> The primary use of collected data is to enhance the functionality and effectiveness of the ChatBot. By analyzing questions and responses, we are able to continually train our model to better serve your needs.
      </p>
      <p className={styles.paragraph}>
        <strong>Communication:</strong> We may use your email address to contact you with updates about our service, respond to inquiries, or provide assistance with any issues related to SolidCAM.
      </p>

      <h3 className={styles.sectionHeader}>Data Sharing and Third-Party Disclosure</h3>
      <p className={styles.paragraph}>
        <strong>No Third-Party Sharing:</strong> We steadfastly refuse to sell or share your personal data with third-party marketers.
      </p>
      <p className={styles.paragraph}>
        <strong>OpenAI Partnership:</strong> Inputs and outputs related to the ChatBot are temporarily stored by OpenAI for a period of 30 days as part of our ongoing efforts to enhance the service, as detailed <a href="#" className={styles.link}>here</a>.
      </p>
      <p className={styles.paragraph}>
        <strong>Compliance and Legal Disclosures:</strong> While we do not share your personal information with third parties, we may disclose information if legally required to do so or if necessary to protect our rights or the rights of others.
      </p>

      <h3 className={styles.sectionHeader}>User Rights</h3>
      <p className={styles.paragraph}>
        <strong>Access and Management:</strong> You have the right to access the personal information we hold about you and to ask for your data to be corrected or deleted. Requests can be made via email at ai@solidcam.app.
      </p>
      <p className={styles.paragraph}>
        <strong>Data Portability:</strong> Upon request, we can provide you with a copy of your data in a commonly used electronic format so that you can manage and move it.
      </p>

      <h3 className={styles.sectionHeader}>Data Security</h3>
      <p className={styles.paragraph}>
        <strong>Protective Measures:</strong> We employ robust technical, administrative, and organizational controls to safeguard your personal data against unauthorized access, loss, or modification. Measures include encryption, access control procedures, and secure software development practices.
      </p>

      <h3 className={styles.sectionHeader}>International Data Transfers</h3>
      <p className={styles.paragraph}>
        <strong>Cross-Border Data Transfers:</strong> Information that we collect may be stored and processed in and transferred between any of the countries in which we operate to enable us to use the information in accordance with this policy.
      </p>

      <h3 className={styles.sectionHeader}>Changes to This Privacy Policy</h3>
      <p className={styles.paragraph}>
        <strong>Updates and Modifications:</strong> We may update this policy periodically to reflect changes in our practices or relevant regulations. We will notify you of significant changes by posting the new privacy policy on our website.
      </p>

      <h3 className={styles.sectionHeader}>Contact Information</h3>
      <p className={styles.paragraph}>
        For any questions or concerns regarding our privacy practices, please contact us at ai@solidcam.app or via our designated support channels.
      </p>
      </div>
    </div>
  );
}