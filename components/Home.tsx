// components/Home.tsx

import React, { useRef, useState, useEffect, ComponentProps, FC } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import LoadingDots from './ui/LoadingDots';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import { auth } from '@/utils/firebase';
import FeedbackComponent from './FeedbackComponent';
import Link from 'next/link';
import {
  RequestsInProgressType,
  CustomLinkProps,
} from '@/interfaces/index_interface';
import Layout from './layout';
import GoogleAnalytics from './GoogleAnalytics';
import useSocket from '@/hooks/useSocket';
import useFileUpload from '@/hooks/useFileUpload';
import useTheme from '@/hooks/useTheme';
import usePasteImageUpload from '@/hooks/usePasteImageUpload';
import MicrophoneRecorder from './MicrophoneRecorder';
import ImageUpload from './ImageUploadFromHome';
import useFileUploadFromHome from '@/hooks/useFileUploadFromHome';
import { ImagePreview, ImagePreviewData } from './ImagePreview';
import EnlargedImageView from './EnlargedImageView';
import { ChatHistoryItem } from './ChatHistory';
import { io, Socket } from 'socket.io-client';
import MemoryService from '@/utils/memoryService';
import { handleWebinarClick, handleDocumentClick } from '@/utils/tracking';


const PRODUCTION_ENV = 'production';
const LOCAL_URL = 'http://localhost:3000';
const PRODUCTION_URL = 'https://solidcam.herokuapp.com/';

let imageUrlUserIcon = '/usericon.png';
let botimageIcon = '/solidcam.png';

if (process.env.NODE_ENV === PRODUCTION_ENV) {
  imageUrlUserIcon = `${PRODUCTION_URL}usericon.png`;
  botimageIcon = `${PRODUCTION_URL}solidcam.png`;
}

const CustomLink: FC<CustomLinkProps> = ({ href, children, ...props }) => {
  return (
    <a href={href} {...props} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
};

const Home: FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState<string>('');
  const [requestsInProgress, setRequestsInProgress] = useState<
    RequestsInProgressType
  >({});
  const [loading, setLoading] = useState<boolean>(false);
  const [errorreact, setError] = useState<string | null>(null);
  // Initialize roomId using lazy initializer
  const [roomId, setRoomId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const storedRoomId = localStorage.getItem('roomId');
      if (storedRoomId) {
        return storedRoomId;
      } else {
        const newRoomId = `room-${Date.now()}`;
        localStorage.setItem('roomId', newRoomId);
        return newRoomId;
      }
    }
    // Fallback for SSR
    return `room-${Date.now()}`;
  });
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [messageState, setMessageState] = useState<{
    messages: Message[];
    history: [string, string][];
    pendingSourceDocs?: Document[];
  }>({
    messages: [],
    history: [],
  });
  const [currentStage, setCurrentStage] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isNewChat, setIsNewChat] = useState(false);
  const { messages, history } = messageState;
  const serverUrl =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000');

  const answerStartRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [textAreaHeight, setTextAreaHeight] = useState<string>('auto');
  const { submitTimeRef, changeRoom } = useSocket(
    serverUrl,
    roomId,
    setRequestsInProgress,
    setMessageState,
    setCurrentStage,
    setRoomId,
  );
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [shouldSubmitAfterTranscription, setShouldSubmitAfterTranscription] =
    useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<ImagePreviewData | null>(
    null,
  );
  const userEmail = auth.currentUser ? auth.currentUser.email : null;
  const [selectedConversation, setSelectedConversation] =
    useState<ChatHistoryItem | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const {
    imagePreviews,
    handleFileChange,
    handleDeleteImage,
    setImagePreviews,
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
  const { uploadProgress: pasteUploadProgress, clearPastedImagePreviews } =
    usePasteImageUpload(roomId, auth, textAreaRef, setHomeImagePreviews);


  // Update localStorage whenever roomId changes
  useEffect(() => {
    if (roomId) {
      localStorage.setItem('roomId', roomId);
    }
  }, [roomId]);

  // Initialize Socket.IO client
  useEffect(() => {
    const newSocket = io(serverUrl, {
      secure: true,
      transports: ['websocket'],
    });

    newSocket.on(`stageUpdate-${roomId}`, (newStage: number) => {
      setCurrentStage(newStage);
    });

    newSocket.on(`resetStages-${roomId}`, (newStage: number) => {
      setCurrentStage(null);
    });

    newSocket.on("removeThumbnails", () => {
      const thumbnailElement = document.querySelector('.image-container-image-thumb');
      if (!thumbnailElement) {
        console.log('Thumbnail element not found');
      } else {
        console.log('Thumbnail element found and will be removed');
        thumbnailElement.remove();
      }
    });

    newSocket.on('connect', () => {
      //console.log('Socket connected');
      if (roomId) {
        newSocket.emit('joinRoom', roomId);
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [serverUrl, roomId]); // Added roomId to dependencies

  // Emit 'joinRoom' whenever socket or roomId changes
  useEffect(() => {
    if (socket && roomId) {
      socket.emit('joinRoom', roomId);
    }
  }, [socket, roomId]);

  useEffect(() => {
    if (shouldSubmitAfterTranscription) {
      handleSubmit();
      setShouldSubmitAfterTranscription(false);
    }
  }, [query]);

  useEffect(() => {
    adjustTextAreaHeight();
  }, [query]);

  useEffect(() => {
    adjustTextAreaHeight();
  }, []);

  useEffect(() => {
    if (socket && roomId) {
      const handleNewToken = (token: string) => {
        setMessageState((prevState) => {
          const lastMessageIndex = prevState.messages.length - 1;
          const lastMessage = prevState.messages[lastMessageIndex];

          if (
            lastMessage &&
            lastMessage.type === 'apiMessage' &&
            !lastMessage.isComplete
          ) {
            // Merge the token with the last message
            const updatedMessages = [...prevState.messages];
            updatedMessages[lastMessageIndex] = {
              ...lastMessage,
              message: lastMessage.message + token,
            };

            return { ...prevState, messages: updatedMessages };
          } else {
            // If there is no incomplete message, create a new apiMessage
            return {
              ...prevState,
              messages: [
                ...prevState.messages,
                {
                  type: 'apiMessage',
                  message: token,
                  sourceDocs: [],
                  isComplete: false,
                  qaId: undefined, // We'll set this in handleFullResponse
                },
              ],
            };
          }
        });
      };

      const handleFullResponse = (message: { answer: string; sourceDocs: any[]; qaId: string; }) => {
      
        const { answer, sourceDocs, qaId } = message;
      
        if (!answer) {
          console.error('No answer found in the full response message.');
          setError('Received an incomplete response from the server.');
          return;
        }
      
        setMessageState((prevState) => {
          const lastMessageIndex = prevState.messages.length - 1;
          const lastMessage = prevState.messages[lastMessageIndex];
      
          if (lastMessage && lastMessage.type === 'apiMessage' && !lastMessage.isComplete) {
            const updatedMessages = [...prevState.messages];
            updatedMessages[lastMessageIndex] = {
              ...lastMessage,
              message: answer, // Replace with the full answer
              sourceDocs: sourceDocs || [],
              isComplete: true,
              qaId: qaId, // Set the qaId here
            };
            
            // Update MemoryService
            MemoryService.updateChatMemory(roomId!, '', message.answer, []);
      
            return {
              ...prevState,
              messages: updatedMessages,
            };
          } else {
            console.warn('No incomplete apiMessage found to update.');
            return prevState;
          }
        });
      };
      

      socket.on(`tokenStream-${roomId}`, handleNewToken);
      socket.on(`fullResponse-${roomId}`, handleFullResponse);

      return () => {
        socket.off(`tokenStream-${roomId}`, handleNewToken);
        socket.off(`fullResponse-${roomId}`, handleFullResponse);
      };
    }
  }, [socket, roomId]);

  // Handle socket reconnection
  useEffect(() => {
    if (socket) {
      socket.on('disconnect', (reason) => {
        //console.warn('Socket disconnected:', reason);
      });

      socket.io.on('reconnect_attempt', (attemptNumber) => {
        //console.log('Attempting to reconnect:', attemptNumber);
      });

      socket.io.on('reconnect', (attemptNumber) => {
        //console.log('Socket reconnected after', attemptNumber, 'attempts');
        if (roomId) {
          socket.emit('joinRoom', roomId);
        }
        // Optionally refresh the page
        // window.location.reload();
      });
    }

    return () => {
      if (socket) {
        socket.off('disconnect');
        socket.io.off('reconnect_attempt');
        socket.io.off('reconnect');
      }
    };
  }, [socket, roomId]);

  const adjustTextAreaHeight = () => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      const baseHeight = 24;
      const newHeight = Math.min(textAreaRef.current.scrollHeight, 10 * baseHeight);
      textAreaRef.current.style.height = `${newHeight}px`;

      const offset = newHeight - baseHeight;
      textAreaRef.current.style.transform = `translateY(-${offset}px)`;
      setTextAreaHeight(`${newHeight}px`);

      document.documentElement.style.setProperty(
        '--textarea-height',
        `${newHeight}px`,
      );
    }
  };

  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
      } else if (query) {
        e.preventDefault();
        handleSubmit(e);
      }
    }
  };

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

  const handleSubmit = async (e?: any) => {
    if (e) e.preventDefault();

    if (!roomId) {
      console.error('No roomId available');
      setError('No roomId available');
      return;
    }

    setError(null);
    const trimmedQuery = query.trim();

    if (
      !trimmedQuery &&
      currentStage !== 4 &&
      homeImagePreviews.length === 0
    ) {
      alert('Please input a question or upload an image');
      return;
    }

    if (requestsInProgress[roomId]) {
      return;
    }

    setRequestsInProgress((prev) => ({ ...prev, [roomId!]: true }));
    setUserHasScrolled(false);
    setLoading(true);
    const question = query.trim();

    const newUserMessage: Message = {
      type: 'userMessage',
      message: question,
      isComplete: true,
      images: homeImagePreviews.slice(0, 3),
    };

    setMessageState((prevState) => {
      const updatedMessages = [...prevState.messages, newUserMessage];
      const updatedHistory = [...prevState.history, [question, ''] as [string, string]];
    
      // Update MemoryService
      MemoryService.updateChatMemory(roomId!, question, '', []);
    
      return {
        ...prevState,
        messages: updatedMessages,
        history: updatedHistory,
      };
    });
    

    setQuery('');

    if (!userEmail) {
      console.error('User not authenticated');
      setLoading(false);
      setRequestsInProgress((prev) => ({ ...prev, [roomId!]: false }));
      return;
    }

    const imageUrls = homeImagePreviews.slice(0, 3).map((preview) => preview.url);

    // Get the full history from MemoryService
    const fullHistory = (await MemoryService.getChatHistory(roomId!)).map(
      (msg) => [msg.content, ''] as [string, string],
    );

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: userEmail,
        },
        body: JSON.stringify({
          question,
          history: fullHistory,
          roomId,
          imageUrls,
          userEmail,
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      // The response will be handled by the socket event listeners
    } catch (error) {
      setError('An error occurred while fetching the data. Please try again.');
      console.error('error', error);
    } finally {
      setRequestsInProgress((prev) => ({ ...prev, [roomId!]: false }));
      setLoading(false);
      setHomeImagePreviews([]);
      clearPastedImagePreviews();
    }
  };

  const handleHistoryItemClick = (conversation: ChatHistoryItem) => {
    let parsedConversation;
    if (typeof conversation.conversation_json === 'string') {
      try {
        parsedConversation = JSON.parse(conversation.conversation_json);
      } catch (error) {
        console.error('Error parsing conversation_json:', error);
        return;
      }
    } else if (Array.isArray(conversation.conversation_json)) {
      parsedConversation = conversation.conversation_json;
    } else {
      console.error(
        'Unexpected conversation_json type:',
        typeof conversation.conversation_json,
      );
      return;
    }

    if (!Array.isArray(parsedConversation)) {
      console.error('Invalid conversation format:', parsedConversation);
      return;
    }

    setMessageState({
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

    if (socket) {
      socket.emit('joinRoom', conversation.roomId);
    }

    changeRoom(conversation.roomId);
  };

  // Function to handle starting a new chat
  const handleNewChat = () => {
    // Clear the previous chat messages
    setMessageState({
      messages: [],
      history: [],
    });

    // Clear MemoryService
    MemoryService.clearChatMemory(roomId!);

    // Create a new room ID
    const newRoomId = `room-${Date.now()}`;
    setRoomId(newRoomId);
    localStorage.setItem('roomId', newRoomId);

    // Tell the socket to join the new room
    if (socket) {
      socket.emit('joinRoom', newRoomId);
    }

    setIsNewChat(true)
  };

  // Function to load the user's latest chat history
  const loadChatHistory = async () => {
    if (!roomId) return;
  
    try {
      const response = await fetch(`/api/latest-chat-history?userEmail=${userEmail}&roomId=${roomId}`);
      
      if (response.ok) {
        const historyData = await response.json();
        if (historyData && historyData.conversation_json) {
          const conversation = historyData.conversation_json;
  
          setMessageState({
            messages: conversation.map((msg: any) => ({
              ...msg,
              sourceDocs: msg.sourceDocs || [],
              isComplete: msg.type === 'apiMessage' ? true : msg.isComplete,
              qaId: msg.type === 'apiMessage' ? msg.qaId : undefined,
            })),
            history: conversation
              .filter((msg: any) => msg.type === 'userMessage')
              .map((msg: any) => [msg.message, ''] as [string, string]),
          });
  
          MemoryService.loadFullConversationHistory(roomId, conversation);
        }
      } else if (response.status === 404) {
        // Handle 404 by returning without logging anything
        //console.log('No chat history found for room:', roomId); // Optional: Only for debugging
        return; // Avoid error or further processing
      } else {
        throw new Error('Failed to load chat history.');
      }
    } catch (error) {
      // Handle any other errors, if necessary
      setError('Error loading chat history. Please try again later.');
    }
  };
  

  // Load chat history on component mount (page refresh)
  useEffect(() => {
    if (userEmail && roomId && !isNewChat) {
      loadChatHistory();
    }
  }, [userEmail, roomId, isNewChat]);

  useEffect(() => {
    const handleScrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    handleScrollToTop();

    return () => {};
  }, []);

  useEffect(() => {
    if (messageListRef.current && !userHasScrolled) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, userHasScrolled]);

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

  return (
    <>
      <GoogleAnalytics /> {}
      <Layout
        theme={theme}
        toggleTheme={toggleTheme}
        onHistoryItemClick={handleHistoryItemClick}
        handleNewChat={handleNewChat}
      >
        <div className="mx-auto flex flex-col gap-4">
          {/* For internal embedding */}
          {imagePreviews.length > 0 && (
            <div className="image-container-image-thumb">
              {imagePreviews.map((image, index) => (
                <ImagePreview
                  key={index}
                  image={image}
                  index={index}
                  onDelete={handleDeleteImage}
                  uploadProgress={pasteUploadProgress[image.fileName] || null}
                />
              ))}
            </div>
          )}
          {/* Render the EnlargedImageView when an image is clicked */}
          {enlargedImage && (
            <EnlargedImageView
              imageUrl={enlargedImage.url}
              altText={enlargedImage.fileName}
              onClose={() => setEnlargedImage(null)}
            />
          )}

          {homeImagePreviews.length > 0 && !loading && (
            <div className="image-container-image-thumb">
              {homeImagePreviews.map((image, index) => (
                <ImagePreview
                  key={index}
                  image={image}
                  index={index}
                  onDelete={handleHomeDeleteImage}
                  uploadProgress={
                    pasteUploadProgress[image.fileName] ||
                    homeUploadProgress[image.fileName] ||
                    null
                  }
                />
              ))}
            </div>
          )}

          {/* Section to display file errors */}
          {Object.entries(fileErrors).length > 0 && (
            <div className="error-container">
              {Object.entries(fileErrors).map(([fileName, error]) => (
                <div
                  key={fileName}
                  className="border border-red-400 rounded-md p-2 mt-2"
                >
                  <p className="text-red-500 text-sm">{`Error uploading: ${error}`}</p>
                </div>
              ))}
            </div>
          )}
          <main className={styles.main}>
            <h1 className="text-2xl font-bold leading-[1.1] tracking-tighter text-center">
              SolidCAM ChatBot
            </h1>
            <main className={styles.main}>
              <div className="content-container">
                <div className={`${styles.cloud} auto-height`}>
                  <div ref={messageListRef} className={styles.messagelist}>
                    {messages.map((message, index) => {
                      let icon;
                      let className;

                      if (message.type === 'apiMessage') {
                        icon = (
                          <Image
                            key={index}
                            src={botimageIcon}
                            alt="AI"
                            width="40"
                            height="40"
                            className={styles.boticon}
                            priority
                          />
                        );
                        className = styles.apimessage;
                      } else {
                        icon = (
                          <Image
                            key={index}
                            src={imageUrlUserIcon}
                            alt="Me"
                            width="30"
                            height="30"
                            className={styles.usericon}
                            priority
                          />
                        );
                        className =
                          loading && index === messages.length - 1
                            ? styles.usermessagewaiting
                            : styles.usermessage;
                      }
                      
                      let formattedMessage = '';
                      if (typeof message.message === 'string') {
                        formattedMessage = message.message
                          .replace(/\[Image model answer:[\s\S]*?\]/g, '')
                          .trim();
                      }
                    

                      // Map imageUrls from JSON to images expected by the Message interface
                      const images = message.imageUrls
                        ? message.imageUrls.map(
                            (url: string, imgIndex: number) => ({
                              url,
                              fileName: `Uploaded Image ${imgIndex + 1}`,
                            }),
                          )
                        : message.images
                        ? message.images.map((image, imgIndex) => ({
                            url: image.url,
                            fileName: image.fileName,
                          }))
                        : [];
                      return (
                        <React.Fragment key={`chatMessageFragment-${index}`}>
                          <div className={className}>
                            {icon}
                            <div
                              className={styles.markdownanswer}
                              ref={answerStartRef}
                            >
                              {/* Render the images for userMessage */}
                              {images.length > 0 && (
                                <div
                                  className="image-container"
                                  style={{
                                    marginBottom: '10px',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '10px',
                                    justifyContent: 'start',
                                  }}
                                >
                                  {images.map((image, imgIndex) => (
                                    <div
                                      key={imgIndex}
                                      style={{
                                        width: '150px',
                                        height: '150px',
                                        overflow: 'hidden',
                                        position: 'relative',
                                      }}
                                    >
                                      <img
                                        src={image.url}
                                        alt={`User uploaded: ${image.fileName}`}
                                        style={{
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'cover',
                                          cursor: 'pointer',
                                        }}
                                        onClick={() =>
                                          setEnlargedImage(image)
                                        }
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Render the message text (formatted) */}
                              <ReactMarkdown
                                components={{
                                  a: (props: ComponentProps<'a'>) => (
                                    <CustomLink {...props} />
                                  ),
                                }}
                              >
                                {formattedMessage}
                              </ReactMarkdown>
                            </div>
                          </div>

                          {/* Render the sources (webinars, documents) */}
                          {message.sourceDocs &&
                            message.sourceDocs.length > 0 && (
                              <div key={`sourceDocsAccordion-${index}`}>
                                <Accordion
                                  type="single"
                                  collapsible
                                  className="flex-col"
                                >
                                  {message.sourceDocs.map(
                                    (doc, docIndex) => {
                                      let title =
                                        doc.metadata.type === 'youtube'
                                          ? 'Webinar'
                                          : 'Document';
                                      return (
                                        <AccordionItem
                                          key={`messageSourceDocs-${docIndex}`}
                                          value={`item-${docIndex}`}
                                        >
                                          <AccordionTrigger>
                                            <h3>{`${title} ${
                                              docIndex + 1
                                            }`}</h3>
                                          </AccordionTrigger>
                                          <AccordionContent>
                                        {
                                          doc.metadata.type === 'youtube' ? (
                                            <p>
                                              <b>Source:</b>
                                              {doc.metadata.source ? <a href={doc.metadata.source} target="_blank" rel="noopener noreferrer" onClick={() => handleWebinarClick(doc.metadata.source)}>View Webinar</a> : 'Unavailable'}
                                            </p>
                                          ) : doc.metadata.type === 'sentinel' ? (
                                            <p>
                                              <b>Source:</b>
                                              {doc.metadata.source ? <a href={doc.metadata.source} target="_blank" rel="noopener noreferrer" onClick={() => handleDocumentClick(doc.metadata.source)}>View</a> : 'Unavailable'}
                                            </p>
                                          ) : (
                                            <>
                                              <ReactMarkdown
                                                components={{
                                                  a: (props: ComponentProps<'a'>) => <CustomLink {...props} />,
                                                }}
                                              >
                                                {doc.pageContent.split('\n')[0]}
                                              </ReactMarkdown>
                                              <p className="mt-2">
                                                <b>Source:</b>
                                                {
                                                  doc.metadata && doc.metadata.source
                                                    ? (() => {
                                                      const pageNumbers = Array.from(doc.pageContent.matchAll(/\((\d+)\)/g), m => parseInt(m[1], 10));

                                                      const largestPageNumber = pageNumbers.length > 0 ? Math.max(...pageNumbers) : null;

                                                      let candidateNumbers = largestPageNumber !== null ? pageNumbers.filter(n => largestPageNumber - n <= 2) : [];

                                                      let smallestPageNumberInRange = candidateNumbers.length > 0 ? Math.min(...candidateNumbers) : null;

                                                      if (smallestPageNumberInRange === null && largestPageNumber !== null) {
                                                        smallestPageNumberInRange = largestPageNumber;
                                                      }
                                                      const pageLink = smallestPageNumberInRange !== null ? `${doc.metadata.source}#page=${smallestPageNumberInRange}` : doc.metadata.source;

                                                      const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

                                                      const iosPageLink = isiOS ? pageLink.replace('#page=', '#page') : pageLink;

                                                      return <a href={iosPageLink} target="_blank" rel="noopener noreferrer" onClick={() => handleDocumentClick(pageLink)}>View Page</a>;
                                                    })()
                                                    : 'Unavailable'
                                                }
                                              </p>
                                            </>
                                          )
                                        }
                                      </AccordionContent>
                                        </AccordionItem>
                                      );
                                    },
                                  )}
                                </Accordion>
                              </div>
                            )}

                          {/* Render feedback only for apiMessage */}
                          {message.type === 'apiMessage' &&
                            message.isComplete && (
                              <FeedbackComponent
                                key={index}
                                messageIndex={index}
                                qaId={message.qaId}
                                roomId={roomId}
                              />
                            )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            </main>
            <div className={styles.center}>
              <div className={styles.cloudform}>
                <form
                  onSubmit={handleSubmit}
                  className={styles.textareaContainer}
                >
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

                  {/* Conditionally render the ImageUpload component */}
                  {!loading && <ImageUpload handleFileChange={handleFileChange} />}

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
                        <Image
                          src="/image-upload-48.png"
                          alt="Upload JPG"
                          width="30"
                          height="30"
                        />
                      </label>
                    </>
                  )}

                  {currentStage === 4 ? (
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
                        <Image
                          src="/image-upload-48.png"
                          alt="Upload JPG"
                          width="30"
                          height="30"
                        />
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
                {speechError && (
                  <div className="border border-red-400 rounded-md p-4">
                    <p className="text-red-500">{speechError}</p>
                  </div>
                )}
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
            {errorreact && (
              <div className="border border-red-400 rounded-md p-4">
                <p className="text-red-500">{errorreact}</p>
              </div>
            )}
          </main>
        </div>
        <footer className="footer p-4 text-center mt-auto">
          © 2024 SolidCAM™. All rights reserved.
          <p>
            <Link href="/privacy-policy" passHref>
              Privacy Policy
            </Link>
          </p>
        </footer>
      </Layout>
    </>
  );
};

export default Home;
