// components/core/Chat/ChatContainer.tsx
import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { Box, Container, Typography } from '@mui/material';
import useChat from '@/hooks/useChat';
import useTextAreaHeight from '@/hooks/useTextAreaHeight';
import useTheme from '@/hooks/useTheme';
import useFileUpload from '@/hooks/useFileUpload';
import usePasteImageUpload from '@/hooks/usePasteImageUpload';
import useFileUploadFromHome from '@/hooks/useFileUploadFromHome';
import { getTemplateConfig } from '../../../config/template';
import { auth } from '@/utils/firebase';
import { handleSubmitClick } from '@/utils/tracking';
import MemoryService from '@/utils/memoryService';
import Cookies from 'js-cookie';

// Import components with the new structure
import { MessageList, ChatInput } from '@/components/core/Chat';
import { 
  MicrophoneRecorder, 
  ImageUpload, 
  ImagePreview, 
  EnlargedImageView 
} from '@/components/core/Media';
import Layout from '@/components/core/Layout';
import { 
  LoadingDots 
} from '@/components/ui/Loaders';
import { 
  InitialDisclaimerModal 
} from '@/components/ui/Modals';
import { 
  Tooltip
} from '@/components/ui/Feedback';
import { 
  GoogleAnalytics 
} from '@/components/analytics';

// Environment constants
const PRODUCTION_ENV = 'production';
const PRODUCTION_URL = '{{PRODUCTION_URL}}'; // Will be replaced during deployment

// Image paths with environment awareness
// NOTE: bot-icon-placeholder.svg should be replaced with client's custom bot icon during deployment
const getImagePaths = () => {
  const basePath = process.env.NODE_ENV === PRODUCTION_ENV ? PRODUCTION_URL : '/';
  return {
    userIconPath: `${basePath}usericon.png`,
    botIconPath: `${basePath}bot-icon-placeholder.svg`, // Placeholder - will be replaced with client's icon
  };
};

interface ChatContainerProps {}

const ChatContainer: React.FC<ChatContainerProps> = () => {
  const config = getTemplateConfig();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState<string>('');
  const [textAreaHeight, setTextAreaHeight] = useState<string>('auto');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const answerStartRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const { userIconPath, botIconPath } = getImagePaths();

  // Room ID initialization
  const initialRoomId = typeof window !== 'undefined' 
    ? localStorage.getItem('roomId') || `room-${Date.now()}`
    : null;

  if (typeof window !== 'undefined' && initialRoomId && !localStorage.getItem('roomId')) {
    localStorage.setItem('roomId', initialRoomId);
  }

  // Get server URL
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  // Use custom hooks
  const { 
    roomId, 
    setRoomId, 
    requestsInProgress, 
    setRequestsInProgress,
    loading, 
    setLoading,
    error: chatError, 
    setError,
    messageState,
    setMessageState, 
    currentStage,
    setCurrentStage,
    submitTimeRef,
    changeRoom,
    handleNewChat: handleNewChatInternal,
    loadChatHistory
  } = useChat({ 
    serverUrl, 
    initialRoomId 
  });  const { adjustTextAreaHeight } = useTextAreaHeight({
    textAreaRef,
    content: query,
    setTextAreaHeight
  });

  // Additional state for UI
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [shouldSubmitAfterTranscription, setShouldSubmitAfterTranscription] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<any>(null);
  const [isEmbeddingMode, setIsEmbeddingMode] = useState(false);
  const [isNewChat, setIsNewChat] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);

  // User information
  const userEmail = auth.currentUser ? auth.currentUser.email : 'testuser@example.com';

  // Image upload hooks
  const {
    imagePreviews,             // embedding images
    handleFileChange,          // embed file change
    handleDeleteImage,
    setImagePreviews,          // we can push images here in stage=4
    uploadProgress: internalUploadProgress,
  } = useFileUpload(setQuery, roomId, auth, setUploadStatus);

  const {
    homeImagePreviews,
    handleHomeFileChange,
    handleHomeDeleteImage,
    setHomeImagePreviews,
    fileInputRef,
    uploadProgress: homeUploadProgress,
    fileErrors,
  } = useFileUploadFromHome(setQuery, roomId, auth, setUploadStatus);

  const {
    uploadProgress: pasteUploadProgress,
    clearPastedImagePreviews
  } = usePasteImageUpload(
    roomId,
    auth,
    textAreaRef,
    setHomeImagePreviews, // normal usage
    setImagePreviews,     // embedding usage
    currentStage,
    setQuery
  );

  // Show disclaimer on initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      const hasAcceptedDisclaimer = Cookies.get('disclaimer_accepted');
      if (!hasAcceptedDisclaimer) {
        setShowDisclaimer(true);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Handle disclaimer acceptance
  const handleDisclaimerAccept = () => {
    Cookies.set('disclaimer_accepted', 'true', { expires: 365 }); // Cookie expires in 1 year
    setShowDisclaimer(false);
  };

  // Update localStorage whenever roomId changes
  useEffect(() => {
    if (roomId) {
      localStorage.setItem('roomId', roomId);
    }
  }, [roomId]);

  // Process transcription
  useEffect(() => {
    if (shouldSubmitAfterTranscription) {
      handleSubmit();
      setShouldSubmitAfterTranscription(false);
    }
  }, [query]);  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = e.target;
    if (currentStage === 4) {
      const lines = value.split('\n');
      const existingLines = query.split('\n');

      const isEditingUrl = lines.some((line, index) => {
        const existingLine = existingLines[index] || '';
        return existingLine.startsWith('http') && line !== existingLine;
      });

      if (isEditingUrl) {
        return;
      }
    }
    setQuery(value);
  };

  // Handle key presses
  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow new line with shift+enter
      } else if (query) {
        e.preventDefault();
        handleSubmit(e);
      }
    }
  };

  // Handle submission of chat messages
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
  
    // For Google Analytics
    handleSubmitClick();
  
    if (!roomId) {
      console.error('No roomId available');
      setError('No roomId available');
      return;
    }
  
    setError(null);
    const trimmedQuery = query.trim();
  
    // Skip validation completely if we're in embedding mode at stage 4
    const skipValidation = isEmbeddingMode || currentStage === 4;
    if (!skipValidation && !trimmedQuery && homeImagePreviews.length === 0) {
      alert('Please input a question or upload an image');
      return;
    }
  
    if (requestsInProgress[roomId]) {
      return;
    }
  
    setRequestsInProgress((prev) => ({ ...prev, [roomId!]: true }));
    setUserHasScrolled(false);
    setLoading(true);
  
    // Check if user is now authenticated
    const currentUser = auth.currentUser;
    
    // Get user identifier
    let userIdentifier;
    if (currentUser?.email) {
      userIdentifier = currentUser.email;
      localStorage.removeItem('webBrowserId');
    } else {
      const webBrowserId = localStorage.getItem('webBrowserId');
      userIdentifier = webBrowserId || 'anonymous';
    }
  
    try {
      // Add user message to state
      const newUserMessage = {
        type: 'userMessage',
        message: trimmedQuery,
        isComplete: true,
        images: homeImagePreviews.slice(0, 3),
      };      setMessageState((prevState) => ({
        ...prevState,
        messages: [...prevState.messages, newUserMessage],
        history: [...prevState.history, [trimmedQuery, ''] as [string, string]],
      }));

      setQuery('');
      setIsAwaitingResponse(true);
  
      let fullHistory: [string, string][] = [];
      try {
        const history = await MemoryService.getChatHistory(roomId!);
        fullHistory = history.map((msg) => [msg.content, ''] as [string, string]);
      } catch (error) {
        console.error('Failed to fetch chat history:', error);
      }
  
      // Activate embedding mode if the query starts with respective keyword
      const codePrefix = process.env.NEXT_PUBLIC_CODE_PREFIX ?? "";
      if (trimmedQuery.startsWith(codePrefix)) {
        setIsEmbeddingMode(true);
      }
  
      // Determine the endpoint based on the active mode
      const isEmbedding = isEmbeddingMode || trimmedQuery.startsWith(codePrefix);
      const endpoint = isEmbedding ? '/api/userEmbed' : '/api/chat';
      const imagePreviewsToUse = isEmbedding ? imagePreviews : homeImagePreviews;
      const imageUrls = imagePreviewsToUse.slice(0, 3).map(preview => preview.url);
  
      // Prepare the request body
      const requestBody = JSON.stringify({
        question: trimmedQuery,
        history: fullHistory,
        roomId,
        imageUrls,
        userEmail: userIdentifier,
      });
  
      // Send the request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: userIdentifier,
        },
        body: requestBody,
      });
  
      if (!response.ok) {
        if (response.status === 503) {
          // This is likely a DeepSeek service unavailable error
          console.error('Service temporarily unavailable (503)');
          throw new Error('Service temporarily unavailable');
        } else {
          // For other errors, throw normally
          throw new Error(`Server responded with status: ${response.status}`);
        }
      }
  
    } catch (error) {
      console.error('Error in submit:', error);
       
      // Check if it's a DeepSeek 503 error (which we want to suppress)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage === 'Service temporarily unavailable') {
        // Don't show the error to the user, just log it
        console.log('Suppressing DeepSeek service unavailable error display');
      } else {
        // Display other errors normally
        setError('An error occurred while fetching the data. Please try again.');
      }
    } finally {
      setRequestsInProgress((prev) => ({ ...prev, [roomId!]: false }));
      setLoading(false);
      setIsAwaitingResponse(false);
      setHomeImagePreviews([]);
      clearPastedImagePreviews();
    }
  };  // Wrapper for the internal new chat handler
  const handleNewChat = () => {
    handleNewChatInternal();
    setIsNewChat(true);
    setIsEmbeddingMode(false);
    setIsAwaitingResponse(false);
  };

  // Scroll message list to bottom when messages change
  useEffect(() => {
    if (messageListRef.current && !userHasScrolled) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messageState.messages, userHasScrolled]);

  // Stop highlight when first API token arrives
  useEffect(() => {
    if (isAwaitingResponse) {
      const lastMsg = messageState.messages[messageState.messages.length - 1];
      if (lastMsg && lastMsg.type === 'apiMessage' && !lastMsg.isComplete) {
        setIsAwaitingResponse(false);
      }
    }
  }, [messageState.messages, isAwaitingResponse]);

  // Handle message list scroll events
  useEffect(() => {
    const handleScroll = () => {
      if (messageListRef.current) {
        const isAtBottom =
          messageListRef.current.scrollHeight -
            messageListRef.current.scrollTop ===
          messageListRef.current.clientHeight;
        if (!isAtBottom) {
          setUserHasScrolled(true);
        }
      }
    };

    const messageListElement = messageListRef.current;
    messageListElement?.addEventListener('scroll', handleScroll);

    return () => messageListElement?.removeEventListener('scroll', handleScroll);
  }, []);

  // Load chat history on initial load
  useEffect(() => {
    if (userEmail && roomId && !isNewChat) {
      loadChatHistory();
    }
  }, [userEmail, roomId, isNewChat, loadChatHistory]);

  // Scroll to top on load
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Clean up authentication listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user?.email) {
        // User is signed in with email
        localStorage.removeItem('webBrowserId');
      }
    });
  
    return () => unsubscribe(); // Cleanup subscription
  }, []);

  const isPrivateDelete = currentStage !== 4;
  const { messages } = messageState;

  return (
    <>
      <GoogleAnalytics />
      {showDisclaimer && <InitialDisclaimerModal onAccept={handleDisclaimerAccept} />}
      <Layout
        theme={theme}
        toggleTheme={toggleTheme}
        onHistoryItemClick={(conversation) => {
          const parsedConversation = Array.isArray(conversation.conversation_json)
            ? conversation.conversation_json
            : JSON.parse(conversation.conversation_json || '[]');

          if (!Array.isArray(parsedConversation)) {
            console.error('Invalid conversation format:', parsedConversation);
            return;
          }          setMessageState({
            messages: parsedConversation.map((msg) => ({
              ...msg,
              sourceDocs: msg.sourceDocs || [],
              isComplete: msg.type === 'apiMessage' ? true : msg.isComplete,
              qaId: msg.type === 'apiMessage' ? msg.qaId : undefined,
            })),
            history: parsedConversation
              .filter((msg) => msg.type === 'userMessage')
              .map((msg) => [msg.message, ''] as [string, string]),
          });

          MemoryService.loadFullConversationHistory(
            conversation.roomId,
            parsedConversation,
          );

          setRoomId(conversation.roomId);
          localStorage.setItem('roomId', conversation.roomId);
          changeRoom(conversation.roomId);
        }}
        handleNewChat={handleNewChat}
      >
        <Container maxWidth="md">
          <Box display="flex" flexDirection="column" gap={2}>
          {/* For internal embedding - No change needed here */}
          {imagePreviews.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                m: '8px 0',
              }}
            >
              {imagePreviews.map((image, index) => (
                <ImagePreview
                  key={index}
                  image={image}
                  index={index}
                  onDelete={handleDeleteImage}
                  uploadProgress={pasteUploadProgress[image.fileName] || null}
                />
              ))}
            </Box>
          )}
          
          {/* Render the EnlargedImageView when an image is clicked */}
          {enlargedImage && (
            <EnlargedImageView
              imageUrl={enlargedImage.url}
              altText={enlargedImage.fileName}
              onClose={() => setEnlargedImage(null)}
            />
          )}

          <Box
            component="main"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 2,
              height: '100%',
            }}
          >
            <Typography variant="h4" align="center" fontWeight="bold" gutterBottom>
              {config.productName} ChatBot
            </Typography>

            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                width: '75vw',
                height: 'calc(100vh - 250px)', 
                position: 'relative',
              }}
            >
              {/* Chat pane (top) */}
              <Box
                sx={{
                  flex: '1 1 auto', // Allow shrinking
                  minHeight: 0,
                  overflow: 'hidden',
                  width: '100%',
                  mb: '5px',
                  borderRadius: 2,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    border: theme === 'dark' ? '1px solid #444' : '1px solid #e0e0e0',
                    borderRadius: 2,
                    boxShadow: theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                    backgroundColor: theme === 'dark' ? '#121212' : 'white',
                    overflow: 'hidden',
                    mb: '5px', // Reduced margin
                    position: 'relative',
                    transition: 'height 0.3s ease',
                    flex: '1 1 auto', // Allow shrinking
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '100px', // Ensure a minimum height
                  }}
                >
                  <Box
                    ref={messageListRef}
                    className="chat-message-list"
                    sx={{
                      width: '100%',
                      flex: '1 1 auto', // Allow this to shrink
                      overflowY: 'auto', // This ensures the chat content scrolls
                      borderRadius: '0.5rem',
                      position: 'relative',
                      paddingBottom: '10px', // Reduced padding
                      marginBottom: '5px', // Reduced margin
                      scrollPaddingBottom: '20px', // Reduced scroll padding
                    }}
                  >
                    <MessageList
                      messages={messages}
                      loading={loading}
                      answerStartRef={answerStartRef}
                      setEnlargedImage={setEnlargedImage}
                      botimageIcon={botIconPath}
                      imageUrlUserIcon={userIconPath}
                      roomId={roomId}
                      theme={theme}
                      highlightLastUserMessage={isAwaitingResponse}
                    />
                  </Box>
                </Box>
              </Box>
              {/* Image thumbnails (middle) */}
              {homeImagePreviews.length > 0 && !loading && (
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-start',
                    gap: '8px',
                    width: '100%',
                    p: '8px 0',
                    mb: '30px',
                    maxHeight: '166px',
                    overflowY: 'auto',
                    visibility: 'visible',
                  }}
                  className="chat-message-list"
                >
                  {homeImagePreviews.map((image, index) => (
                    <ImagePreview
                      key={image.fileName} // Use fileName as key
                      image={image}
                      index={index}
                      onDelete={() => handleHomeDeleteImage(image.fileName, isPrivateDelete)}
                      uploadProgress={
                        pasteUploadProgress[image.fileName] ||
                        homeUploadProgress[image.fileName] ||
                        null
                      }
                      onClick={() => setEnlargedImage(image)}
                    />
                  ))}
                </Box>
              )}
              
              {/* Section to display file errors */}
              {Object.entries(fileErrors).length > 0 && (
                <Box>
                  {Object.entries(fileErrors).map(([fileName, error]) => (
                    <Box
                      key={fileName}
                      sx={{ border: '1px solid', borderColor: 'error.main', borderRadius: 1, p: 1, mt: 2 }}
                    >
                      <Typography color="error" variant="body2">{`Error uploading: ${error}`}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
              
              {/* Text input section */}
              <Box sx={{ flexShrink: 0 }}>
                <ChatInput
                  query={query}
                  setQuery={setQuery}
                  loading={loading}
                  isTranscribing={isTranscribing}
                  isMicActive={isMicActive}
                  setIsMicActive={setIsMicActive}
                  setIsTranscribing={setIsTranscribing}
                  handleSubmit={handleSubmit}
                  handleChange={handleChange}
                  handleEnter={handleEnter}
                  textAreaRef={textAreaRef}
                  currentStage={currentStage}
                  handleFileChange={handleFileChange}
                  handleHomeFileChange={handleHomeFileChange}
                  fileInputRef={fileInputRef}
                />
              </Box>
            </Box>
            
            {speechError && (
              <Box sx={{ border: '1px solid', borderColor: 'error.main', borderRadius: 1, p: 2 }}>
                <Typography color="error">{speechError}</Typography>
              </Box>
            )}

            {chatError && (
              <Box sx={{ border: '1px solid', borderColor: 'error.main', borderRadius: 1, p: 2 }}>
                <Typography color="error">{chatError}</Typography>
              </Box>
            )}
          </Box>
          </Box>
        </Container>
        <Box component="footer" sx={{ p: 2, textAlign: 'center', mt: 'auto' }}>
          © 2024 {config.companyName}™. All rights reserved.
          <p>
            <Link href="/privacy-policy" passHref>
              Privacy Policy
            </Link>
          </p>
        </Box>
      </Layout>
    </>
  );
};

export default ChatContainer;