import React, { useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
} from '@mui/material';

interface RemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageIndex: number | null;
  onSubmit: (messageIndex: number | null, remark: string) => void;
  feedbackType: 'up' | 'down' | 'comment';
}

const PRODUCTION_ENV = 'production';

// Define icon paths with environment awareness
const getIconPaths = () => {
  // Use relative paths for all environments since Vercel handles static assets correctly
  const basePath = '/';
  return {
    thumbUpIcon: `${basePath}icons8-thumb-up-50.png`,
    thumbDownIcon: `${basePath}icons8-thumbs-down-50.png`,
    commentIcon: `${basePath}icons8-message-50.png`,
  };
};

const RemarksModal: React.FC<RemarksModalProps> = ({
  isOpen,
  onClose,
  messageIndex,
  onSubmit,
  feedbackType
}) => {
  const [remark, setRemark] = useState('');
  const { thumbUpIcon, thumbDownIcon, commentIcon } = getIconPaths();

  // Determine text based on feedback type
  const modalText = {
    up: "What do you like about the response?",
    down: "What didn't you like about the response?",
    comment: "Please leave your comment:"
  }[feedbackType];

  // Determine icon based on feedback type
  const iconSrc = {
    up: thumbUpIcon,
    down: thumbDownIcon,
    comment: commentIcon
  }[feedbackType];

  const submitRemark = () => {
    if (messageIndex !== null) {
      onSubmit(messageIndex, remark);
      setRemark('');  // Clear the remark
    }
    onClose(); // Close the modal after submission
  };

  if (!isOpen) return null;

  return (
    <Dialog 
      open 
      onClose={onClose} 
      aria-labelledby="remarks-title"
      maxWidth="md" // Increased from default "sm" to "md" for wider dialog
      fullWidth // Makes the dialog take up the full width of its maxWidth
      PaperProps={{
        sx: {
          minHeight: '350px', // Make the dialog taller
          width: '550px'      // Set a specific width
        }
      }}
    >
      <DialogTitle id="remarks-title" sx={{ 
        display: 'flex', 
        alignItems: 'center',
        padding: '16px 20px',
        fontSize: '18px',
        fontWeight: 500
      }}>
        {iconSrc && (
          <Image
            src={iconSrc}
            alt="Feedback Icon"
            width={28}
            height={28}
            style={{ marginRight: 12, filter: 'brightness(0) invert(1)' }}
          />
        )}
        Provide additional feedback
      </DialogTitle>
      <DialogContent dividers sx={{ padding: '20px' }}>
        <Typography variant="body1" paragraph sx={{ marginBottom: '15px', fontSize: '16px' }}>
          {modalText}
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={5}  // Increased from 3 to 5 rows
          maxRows={12} // Added max rows
          placeholder="Your remarks..."
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          sx={{ 
            '& .MuiInputBase-root': { 
              minHeight: '150px' // Set minimum height for the input
            }
          }}
        />
      </DialogContent>
      <DialogActions sx={{ padding: '16px 20px' }}>
        <Button 
          variant="outlined" 
          onClick={onClose} 
          color="primary" 
          sx={{ marginRight: '10px', minWidth: '80px' }}
        >
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={submitRemark} 
          color="primary"
          sx={{ minWidth: '120px' }}
        >
          Submit feedback
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RemarksModal;