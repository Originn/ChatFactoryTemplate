import React, { useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { Send } from 'lucide-react';
import { LoadingDots } from '@/components/ui/Loaders';
import { MicrophoneRecorder } from '@/components/core/Media';
import Image from 'next/image';
import useTheme from '@/hooks/useTheme';

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
                : 'Message SolidCAM ChatBot...'
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

        {/* General file upload */}
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
            <Tooltip title="Upload image">
              <IconButton 
                component="label" 
                htmlFor="generalFileInput" 
                sx={{ 
                  position: 'absolute', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  right: 96, 
                  zIndex: 1 
                }}
              >
                <Image src="/image-upload-48.png" alt="Upload JPG" width={20} height={20} />
              </IconButton>
            </Tooltip>
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
              setQuery={setQuery}
              loading={loading}
              setIsTranscribing={setIsTranscribing}
              isTranscribing={isTranscribing}
              setIsMicActive={setIsMicActive}
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
              <Tooltip title="Upload image">
                <IconButton 
                  component="label" 
                  htmlFor="fileInput" 
                  sx={{ 
                    position: 'absolute', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    right: 56, 
                    zIndex: 1 
                  }}
                >
                  <Image src="/image-upload-48.png" alt="Upload JPG" width={20} height={20} />
                </IconButton>
              </Tooltip>
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

      <Box textAlign="center" mt={1}>
        <Typography variant="caption" color="text.secondary">
          SolidCAM ChatBot may display inaccurate info so double-check its responses
        </Typography>
      </Box>
    </Box>
  );
};

export default ChatInput;