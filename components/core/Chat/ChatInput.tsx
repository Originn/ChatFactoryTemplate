import React from 'react';
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
  return (
    <Box sx={{ position: 'relative', width: '100%', mt: 1 }}>
      <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
        <TextField
          disabled={loading}
          onKeyDown={handleEnter}
          onChange={handleChange}
          inputRef={textAreaRef}
          autoFocus={false}
          multiline
          maxRows={4}
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
          fullWidth
        />

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
              <IconButton component="label" htmlFor="generalFileInput" sx={{ position: 'absolute', right: 96, top: 8 }}>
                <Image src="/image-upload-48.png" alt="Upload JPG" width={24} height={24} />
              </IconButton>
            </Tooltip>
          </>
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
                <IconButton component="label" htmlFor="fileInput" sx={{ position: 'absolute', right: 56, top: 8 }}>
                  <Image src="/image-upload-48.png" alt="Upload JPG" width={24} height={24} />
                </IconButton>
              </Tooltip>
            </>
          )
        ) : (
          <MicrophoneRecorder
            setQuery={setQuery}
            loading={loading}
            setIsTranscribing={setIsTranscribing}
            isTranscribing={isTranscribing}
            setIsMicActive={setIsMicActive}
          />
        )}

        {!isMicActive && (
          <Tooltip title="Send">
            <IconButton
              type="submit"
              id="submitButton"
              disabled={loading || isTranscribing}
              sx={{ position: 'absolute', right: 16, top: 8 }}
              aria-label="Send message"
            >
              {loading || isTranscribing ? (
                <LoadingDots color="#000" />
              ) : (
                <Send size={20} />
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