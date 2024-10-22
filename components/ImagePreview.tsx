// components/ImagePreview.tsx
import React, { useState, useEffect } from 'react';
import CircularProgressBar from './CircularProgressBar';
import { auth } from '@/utils/firebase';

interface ImagePreviewData {
  url: string;
  fileName: string;
}

interface ImagePreviewProps {
  image: ImagePreviewData;
  index: number;
  onDelete: (fileName: string, index: number) => void;
  uploadProgress: number | null;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ 
  image, 
  index, 
  onDelete, 
  uploadProgress 
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
    <div className="image-wrapper relative">
      {isRefreshing ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
        </div>
      ) : (
        <>
          <img
            src={imageUrl}
            alt={`Preview ${index + 1}`}
            className="image-preview"
            onError={handleImageError}
            style={{ 
              width: '150px', 
              height: '150px', 
              objectFit: 'cover',
              borderRadius: '8px'
            }}
          />
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-100 bg-opacity-75">
              <button 
                onClick={refreshImageUrl}
                className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Retry
              </button>
            </div>
          )}
        </>
      )}

      <button 
        onClick={() => onDelete(image.fileName, index)}
        className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md hover:bg-red-100"
      >
        ×
      </button>

      {uploadProgress !== null && uploadProgress < 100 && (
        <div className="absolute bottom-2 right-2">
          <CircularProgressBar progress={uploadProgress} />
        </div>
      )}
    </div>
  );
};

export type { ImagePreviewData };