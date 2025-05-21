import React from 'react';
import styles from '@/styles/Home.module.css';

interface EnlargedImageViewProps {
  imageUrl: string;
  altText: string;
  onClose: () => void;
}

const EnlargedImageView: React.FC<EnlargedImageViewProps> = ({ 
  imageUrl, 
  altText, 
  onClose 
}) => {
  // Prevent clicking inside the image from closing the view
  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className={styles.enlargedImageOverlay} onClick={onClose}>
      <div className={styles.enlargedImageContainer}>
        <button 
          className={styles.closeButton} 
          onClick={onClose}
          aria-label="Close image view"
        >
          ×
        </button>
        <img
          src={imageUrl}
          alt={altText || 'Enlarged image'}
          className={styles.enlargedImage}
          onClick={handleImageClick}
        />
      </div>
    </div>
  );
};

export default EnlargedImageView;