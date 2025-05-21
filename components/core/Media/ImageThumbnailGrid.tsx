import React from 'react';
import { Box, IconButton, LinearProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ImagePreviewData } from '@/components/core/Media';

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
    <Box display="flex" flexWrap="wrap" gap={1} mb={3} sx={{ maxHeight: 166, overflowY: 'auto' }}>
      {images.map((image) => {
        const progress = uploadProgress[image.fileName] || null;

        return (
          <Box
            key={image.fileName}
            position="relative"
            sx={{ width: 75, height: 75, borderRadius: 1, overflow: 'hidden' }}
          >
            <Box
              component="img"
              src={image.url}
              alt={`Preview: ${image.fileName}`}
              onClick={() => onImageClick(image)}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
            />
            {progress !== null && progress < 100 && (
              <Box
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                sx={{ bgcolor: 'rgba(0,0,0,0.5)' }}
              >
                <Box width="80%">
                  <LinearProgress variant="determinate" value={progress} />
                </Box>
              </Box>
            )}
            <IconButton
              size="small"
              onClick={() => onDelete(image.fileName, isPrivateDelete)}
              aria-label="Delete image"
              sx={{ position: 'absolute', top: 2, right: 2, bgcolor: 'rgba(0,0,0,0.5)', width: 20, height: 20 }}
            >
              <CloseIcon fontSize="small" sx={{ color: 'white' }} />
            </IconButton>
          </Box>
        );
      })}
    </Box>
  );
};

export default ImageThumbnailGrid;