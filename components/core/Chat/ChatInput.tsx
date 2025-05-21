import React, { useRef, useEffect } from 'react';
import styles from '@/styles/Home.module.css';
import { LoadingDots } from '@/components/ui/Loaders';
import { Tooltip } from '@/components/ui/Feedback';
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
    <div className={styles.inputContainer}>
      <div className={styles.cloudform}>
        <form className={styles.textareaContainer} onSubmit={handleSubmit}>
          <textarea
            disabled={loading}
            onKeyDown={handleEnter}
            onChange={handleChange}
            ref={textAreaRef}
            autoFocus={false}
            rows={1}
            maxLength={50000}
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
            className={styles.textarea}
            readOnly={currentStage === 4}
          />
          
          {/* Conditionally render the general file input and label */}
          {!loading && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleHomeFileChange}
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                id="generalFileInput"
              />
              <label
                htmlFor="generalFileInput"
                className={styles.fileUploadButton}
                title="Upload image"
              >
                <Tooltip message="Upload image" hideOnClick={true}>
                  <Image
                    src="/image-upload-48.png"
                    alt="Upload JPG"
                    width={30}
                    height={30}
                  />
                </Tooltip>
              </label>
            </>
          )}          {currentStage === 4 ? (
            !loading && (
              <label
                htmlFor="fileInput"
                className={styles.fileUploadButton}
              >
                <input
                  id="fileInput"
                  type="file"
                  accept="image/jpeg"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  multiple
                />
                <Tooltip message="Upload image" hideOnClick={true}>
                  <Image
                    src="/image-upload-48.png"
                    alt="Upload JPG"
                    width={30}
                    height={30}
                  />
                </Tooltip>
              </label>
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
            <button
              type="submit"
              id="submitButton"
              disabled={loading || isTranscribing}
              className={styles.generatebutton}
              aria-label="Send message"
            >
              {loading || isTranscribing ? (
                <div className={styles.loadingwheel}>
                  <LoadingDots color="#000" />
                </div>
              ) : (
                <svg
                  viewBox="0 0 20 20"
                  className={styles.svgicon}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                </svg>
              )}
            </button>
          )}
        </form>
        
        <div className="disclaimer-container">
          <div className={styles.disclaimerText}>
            <p style={{ fontSize: 'small', color: 'gray' }}>
              SolidCAM ChatBot may display inaccurate info so
              double-check its responses
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;