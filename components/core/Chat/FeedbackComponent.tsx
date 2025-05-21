import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { RemarksModal } from '@/components/ui/Modals';
import { Tooltip, IconButton, Box } from '@mui/material';

// Environment constants
const PRODUCTION_ENV = 'production';
const PRODUCTION_URL = 'https://solidcam.herokuapp.com/';

// Define icon paths with environment awareness
const getIconPaths = () => {
  const basePath = process.env.NODE_ENV === PRODUCTION_ENV ? PRODUCTION_URL : '/';
  return {
    thumbUpIcon: `${basePath}icons8-thumbs-up-30.png`,
    thumbDownIcon: `${basePath}icons8-thumbs-down-30.png`,
    commentIcon: `${basePath}icons8-message-30.png`,
  };
};

interface FeedbackComponentProps {
  messageIndex: number;
  qaId: string | undefined;
  roomId: string | null;
}

const FeedbackComponent: React.FC<FeedbackComponentProps> = ({ 
  messageIndex, 
  qaId, 
  roomId 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'up' | 'down' | 'comment'>('up');
  const { thumbUpIcon, thumbDownIcon, commentIcon } = getIconPaths();
  
  // Detect dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  useEffect(() => {
    setIsDarkMode(document.body.classList.contains('dark'));
    
    // Optional: listen for theme changes
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.body.classList.contains('dark'));
    });
    
    observer.observe(document.body, { 
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const handleOpenModal = (type: 'up' | 'down' | 'comment') => {
    setFeedbackType(type);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmitFeedback = async (remark: string) => {
    if (!qaId) {
      console.error("No qaId found for message index " + messageIndex);
      return;
    }
    if (!roomId) {
      console.error("No roomId found for feedback submission");
      return;
    }

    try {
      const response = await fetch('/api/submit-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qaId,
          thumb: feedbackType,
          comment: remark,
          roomId,
        }),
      });

      if (response.ok) {
        handleCloseModal();
      } else {
        const errorText = await response.text();
        console.error('Failed to submit feedback:', errorText);
      }
    } catch (error) {
      console.error('Network error when submitting feedback:', error);
    }
  };

  // Don't render the component if qaId is undefined
  if (!qaId) return null;

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'flex-start', 
      paddingLeft: '75px',  // Increased to compensate for icon drop
      backgroundColor: isDarkMode ? '#242424' : '#f5f5f5',
      paddingTop: '5px',
      paddingBottom: '10px'
    }}>
      <Tooltip title="Give positive feedback">
        <IconButton onClick={() => handleOpenModal('up')} aria-label="Give positive feedback">
          <Image src={thumbUpIcon} alt="Thumb Up" width={25} height={25} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Give negative feedback">
        <IconButton onClick={() => handleOpenModal('down')} aria-label="Give negative feedback">
          <Image src={thumbDownIcon} alt="Thumb Down" width={25} height={25} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Add a comment">
        <IconButton onClick={() => handleOpenModal('comment')} aria-label="Add a comment">
          <Image src={commentIcon} alt="Comment" width={25} height={25} />
        </IconButton>
      </Tooltip>

      {/* Remarks Modal for feedback submission */}
      {isModalOpen && (
        <RemarksModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          messageIndex={messageIndex}
          onSubmit={(msgIndex, remarkValue) => {
            handleSubmitFeedback(remarkValue);
          }}
          feedbackType={feedbackType}
        />
      )}
    </div>
  );  
};

export default FeedbackComponent;