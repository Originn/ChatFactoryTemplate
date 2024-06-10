// components/UploadStatusBanner.tsx
import React from 'react';
import styles from '@/styles/UploadStatusBanner.module.css'; // Import styles from a new CSS module

interface UploadStatusBannerProps {
  status: string;
}

const UploadStatusBanner: React.FC<UploadStatusBannerProps> = ({ status }) => {
  return (
    <div className={styles.overlay}>
      <div className={styles.banner}>
        <p>{status}</p>
      </div>
    </div>
  );
};

export default UploadStatusBanner;
