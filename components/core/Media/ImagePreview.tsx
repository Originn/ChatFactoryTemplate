import React, { useState, useEffect } from 'react';
import { Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CircularProgressBar } from '@/components/ui/Feedback';
import { auth } from '@/utils/firebase';

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
    <Box position="relative" display="inline-block" sx={{ width: 75, height: 75, borderRadius: 1, overflow: 'hidden' }}>
      {isRefreshing ? (
        <Box position="absolute" top={0} left={0} right={0} bottom={0} display="flex" alignItems="center" justifyContent="center" sx={{ bgcolor: 'rgba(0,0,0,0.5)' }}>
          <Box sx={{ width: 24, height: 24, border: '3px solid rgba(255,255,255,0.3)', borderRadius: '50%', borderTopColor: '#fff', animation: 'spin 1s linear infinite' }} />
        </Box>
      ) : (
        <>
          <Box
            component="img"
            src={imageUrl}
            alt={`Preview ${index + 1}`}
            onClick={onClick}
            onError={handleImageError}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', cursor: onClick ? 'pointer' : 'default' }}
          />

          {error && (
            <Box position="absolute" top={0} left={0} right={0} bottom={0} display="flex" alignItems="center" justifyContent="center" sx={{ bgcolor: 'rgba(255,0,0,0.3)' }}>
              <IconButton size="small" onClick={refreshImageUrl} sx={{ bgcolor: 'white' }}>
                Retry
              </IconButton>
            </Box>
          )}
        </>
      )}

      <IconButton
        size="small"
        onClick={() => onDelete(image.fileName, index)}
        aria-label="Delete image"
        sx={{ position: 'absolute', top: 2, right: 2, bgcolor: 'rgba(0,0,0,0.5)', width: 20, height: 20 }}
      >
        <CloseIcon fontSize="small" sx={{ color: 'white' }} />
      </IconButton>

      {uploadProgress !== null && uploadProgress < 100 && (
        <Box position="absolute" bottom={2} right={2}>
          <CircularProgressBar progress={uploadProgress} />
        </Box>
      )}
    </Box>
  );
};

export default ImagePreview;