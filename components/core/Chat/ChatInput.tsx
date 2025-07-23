import React, { useEffect, useState } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { Send, Plus, Image as ImageIcon, FileText } from 'lucide-react';
import { LoadingDots } from '@/components/ui/Loaders';
import { MicrophoneRecorder } from '@/components/core/Media';
import Image from 'next/image';
import useTheme from '@/hooks/useTheme';
import { getTemplateConfig } from '../../../config/template';

const config = getTemplateConfig();

interface ChatInputProps {
  query: string;
  setQuery: (query: string) => void;
  loading: boolean;
  isTranscribing: boolean;
  isMicActive: boolean;
  setIsMicActive: (active: boolean) => void;
  setIsTranscribing: (transcribing: boolean) => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleEnter: (e: React.KeyboardEvent) => void;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  currentStage: number | null;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleHomeFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const ChatInput: React.FC<ChatInputProps> = ({
  query,
  setQuery,
  loading,
  isTranscribing,
  isMicActive,
  setIsMicActive,
  setIsTranscribing,
  handleSubmit,
  handleChange,
  handleEnter,
  textAreaRef,
  currentStage,
  handleFileChange,
  handleHomeFileChange,
  fileInputRef,
}) => {
  // Get the current theme
  const { theme } = useTheme();
  
  // Menu state for upload options (general)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  
  // Menu state for stage 4 upload options
  const [anchorElStage4, setAnchorElStage4] = useState<null | HTMLElement>(null);
  const openStage4 = Boolean(anchorElStage4);
  
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleMenuClickStage4 = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElStage4(event.currentTarget);
  };
  
  const handleMenuCloseStage4 = () => {
    setAnchorElStage4(null);
  };
  
  const handleImageUpload = () => {
    handleMenuClose();
    fileInputRef.current?.click();
  };
  
  const handleImageUploadStage4 = () => {
    handleMenuCloseStage4();
    // Trigger the stage 4 file input
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.click();
  };
  
  const handleDocumentUpload = () => {
    handleMenuClose();
    // TODO: Implement document upload logic
    console.log('Document upload will be implemented later');
  };
  
  const handleDocumentUploadStage4 = () => {
    handleMenuCloseStage4();
    // TODO: Implement document upload logic for stage 4
    console.log('Document upload for stage 4 will be implemented later');
  };
  
  // Auto-resize textarea based on content, but limit max height
  useEffect(() => {
    if (textAreaRef.current) {
      // Reset height to auto to get the correct scrollHeight
      textAreaRef.current.style.height = 'auto';
      
      // Set the height to scrollHeight if it's greater than the minimum height
      // But limit the maximum height to prevent taking too much space
      const newHeight = Math.min(120, Math.max(44, textAreaRef.current.scrollHeight));
      textAreaRef.current.style.height = `${newHeight}px`;
    }
  }, [query]);

  return (
    <Box sx={{ 
      position: 'relative', 
      width: '100%', 
      mt: 1,
      maxHeight: '140px',  // Limit max height of entire input container
      flexShrink: 0, // Prevent input from shrinking
    }}>
      <form onSubmit={handleSubmit} style={{ 
        position: 'relative',
        marginTop: '5px', // Add margin to separate from message list
        marginBottom: '5px'
      }}>
        <div style={{
          position: 'relative',
          width: '100%',
          minHeight: '44px',
          border: `1px solid ${theme === 'dark' ? '#444444' : '#d9d9e3'}`,
          borderRadius: '0.5rem',
          overflow: 'hidden'
        }}>
          <textarea
            disabled={loading}
            onKeyDown={handleEnter}
            onChange={(e) => handleChange(e as any)}
            ref={textAreaRef as any}
            autoFocus={false}
            id="userInput"
            name="userInput"
            placeholder={
              loading
                ? 'Waiting for response...'
                : isMicActive
                ? ''
                : `Message ${config.productName} ChatBot...`
            }
            value={query}
            rows={1}
            className="chat-message-list"
            style={{
              width: '100%',
              minHeight: '44px',
              maxHeight: '120px', // Limit max height
              padding: '12px 130px 12px 12px',
              fontSize: '0.9rem',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              resize: 'none',
              lineHeight: '20px',
              overflowX: 'hidden',
              overflowY: 'auto', // Allow vertical scrolling when content exceeds max height
              color: theme === 'dark' ? '#ffffff' : '#000000', // Text color based on theme
            }}
          />
        </div>

        {/* Upload options menu */}
        {!loading && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleHomeFileChange}
              accept="image/*"
              multiple
              hidden
              id="generalFileInput"
            />
            <Tooltip title="Upload options">
              <IconButton 
                onClick={handleMenuClick}
                sx={{ 
                  position: 'absolute', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  right: 96, 
                  zIndex: 1 
                }}
              >
                <Plus size={20} />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleMenuClose}
              MenuListProps={{
                'aria-labelledby': 'upload-options-button',
              }}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
            >
              <MenuItem onClick={handleImageUpload}>
                <ListItemIcon>
                  <ImageIcon size={20} />
                </ListItemIcon>
                <ListItemText>Upload Image</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleDocumentUpload}>
                <ListItemIcon>
                  <FileText size={20} />
                </ListItemIcon>
                <ListItemText>Upload Document</ListItemText>
              </MenuItem>
            </Menu>
          </>
        )}

        {/* Microphone recorder positioned between image upload and send button */}
        {currentStage !== 4 && !loading && (
          <Box sx={{ 
            position: 'absolute', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            right: 56, 
            zIndex: 1 
          }}>
            <MicrophoneRecorder
              setQuery={(value) => {
                if (typeof value === 'function') {
                  setQuery(value(query));
                } else {
                  setQuery(value);
                }
              }}
              loading={loading}
              setIsTranscribing={(value) => {
                if (typeof value === 'function') {
                  setIsTranscribing(value(isTranscribing));
                } else {
                  setIsTranscribing(value);
                }
              }}
              isTranscribing={isTranscribing}
              setIsMicActive={(value) => {
                if (typeof value === 'function') {
                  setIsMicActive(value(isMicActive));
                } else {
                  setIsMicActive(value);
                }
              }}
            />
          </Box>
        )}

        {currentStage === 4 ? (
          !loading && (
            <>
              <input
                id="fileInput"
                type="file"
                accept="image/jpeg"
                hidden
                onChange={handleFileChange}
                multiple
              />
              <Tooltip title="Upload options">
                <IconButton 
                  onClick={handleMenuClickStage4}
                  sx={{ 
                    position: 'absolute', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    right: 56, 
                    zIndex: 1 
                  }}
                >
                  <Plus size={20} />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={anchorElStage4}
                open={openStage4}
                onClose={handleMenuCloseStage4}
                MenuListProps={{
                  'aria-labelledby': 'upload-options-stage4-button',
                }}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
              >
                <MenuItem onClick={handleImageUploadStage4}>
                  <ListItemIcon>
                    <ImageIcon size={20} />
                  </ListItemIcon>
                  <ListItemText>Upload Image</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleDocumentUploadStage4}>
                  <ListItemIcon>
                    <FileText size={20} />
                  </ListItemIcon>
                  <ListItemText>Upload Document</ListItemText>
                </MenuItem>
              </Menu>
            </>
          )
        ) : null}

        {!isMicActive && (
          <Tooltip title="Send">
            <IconButton
              type="submit"
              id="submitButton"
              disabled={loading || isTranscribing}
              sx={{ 
                position: 'absolute', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                right: 16, 
                zIndex: 1 
              }}
              aria-label="Send message"
            >
              {loading || isTranscribing ? (
                <LoadingDots color="#000" />
              ) : (
                <Send size={18} />
              )}
            </IconButton>
          </Tooltip>
        )}
      </form>
    </Box>
  );
};

export default ChatInput;