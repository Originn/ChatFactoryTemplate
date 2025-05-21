import React, { useState, useEffect } from 'react';
import { CircularProgressBar } from '@/components/ui/Feedback';
import { auth } from '@/utils/firebase';
import styles from '@/styles/Home.module.css';

export interface ImagePreviewData {
  url: string;
  fileName: string;
}

interface ImagePreviewProps {
  image: ImagePreviewData;
  index: number;
  onDelete: (fileName: string, index?: number) => void;
  uploadProgress: number | null;
  onClick?: () => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ 
  image, 
  index, 
  onDelete, 
  uploadProgress,
  onClick
}) => {
  const [imageUrl, setImageUrl] = useState(image.url);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshImageUrl = async () => {
    const userEmail = auth.currentUser?.email;
    if (!userEmail) return;

    setIsRefreshing(true);
    try {
      const response = await fetch('/api/refresh-image-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': userEmail
        },
        body: JSON.stringify({ fileName: image.fileName })
      });

      if (!response.ok) throw new Error('Failed to refresh URL');

      const data = await response.json();
      setImageUrl(data.url);
      setError(null);
    } catch (err) {
      setError('Failed to load image');
      console.error('Error refreshing image URL:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleImageError = () => {
    refreshImageUrl();
  };

  return (
    <div className={styles.imagePreviewContainer}>
      {isRefreshing ? (
        <div className={styles.refreshingOverlay}>
          <div className={styles.spinner} />
        </div>
      ) : (
        <>
          <img
            src={imageUrl}
            alt={`Preview ${index + 1}`}
            className={styles.imagePreview}
            onClick={onClick}
            onError={handleImageError}
            style={{ cursor: onClick ? 'pointer' : 'default' }}
          />
          
          {error && (
            <div className={styles.errorOverlay}>
              <button 
                onClick={refreshImageUrl}
                className={styles.retryButton}
              >
                Retry
              </button>
            </div>
          )}
        </>
      )}

      <button 
        onClick={() => onDelete(image.fileName, index)}
        className={styles.deleteButton}
        aria-label="Delete image"
      >
        ×
      </button>

      {uploadProgress !== null && uploadProgress < 100 && (
        <div className={styles.progressIndicator}>
          <CircularProgressBar progress={uploadProgress} />
        </div>
      )}
    </div>
  );
};

export default ImagePreview;