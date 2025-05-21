import React from 'react';
import { Dialog, DialogContent, IconButton, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

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
  return (
    <Dialog open onClose={onClose} maxWidth="xl">
      <DialogContent sx={{ position: 'relative', p: 0 }}>
        <IconButton
          onClick={onClose}
          aria-label="Close image view"
          sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'white' }}
        >
          <CloseIcon />
        </IconButton>
        <Box
          component="img"
          src={imageUrl}
          alt={altText || 'Enlarged image'}
          sx={{ maxWidth: '90vw', maxHeight: '90vh', display: 'block' }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default EnlargedImageView;