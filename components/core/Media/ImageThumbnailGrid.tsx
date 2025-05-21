import React from 'react';
import { ImagePreviewData } from '@/components/core/Media';
import styles from '@/styles/Home.module.css';

interface ImageThumbnailGridProps {
  images: ImagePreviewData[];
  onDelete: (fileName: string, isPrivateDelete?: boolean) => void;
  onImageClick: (image: ImagePreviewData) => void;
  uploadProgress: { [key: string]: number | null };
  isPrivateDelete: boolean;
}

const ImageThumbnailGrid: React.FC<ImageThumbnailGridProps> = ({
  images,
  onDelete,
  onImageClick,
  uploadProgress,
  isPrivateDelete,
}) => {
  if (images.length === 0) return null;

  return (
    <div className={styles.imageThumbnailsContainer}>
      {images.map((image, index) => {
        const progress = uploadProgress[image.fileName] || null;
        
        return (
          <div key={image.fileName} className={styles.imagePreviewContainer}>
            <img
              src={image.url}
              alt={`Preview: ${image.fileName}`}
              className={styles.imagePreview}
              onClick={() => onImageClick(image)}
            />
            {progress !== null && progress < 100 && (
              <div className={styles.progressOverlay}>
                <div className={styles.progressBar} style={{ width: `${progress}%` }}></div>
                <div className={styles.progressText}>{`${Math.round(progress)}%`}</div>
              </div>
            )}
            <button
              className={styles.deleteButton}
              onClick={() => onDelete(image.fileName, isPrivateDelete)}
              aria-label="Delete image"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ImageThumbnailGrid;