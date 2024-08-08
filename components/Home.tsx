import React, { useRef, useState, useEffect, ComponentProps, FC } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import LoadingDots from './ui/LoadingDots';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import { auth } from '@/utils/firebase';
import FeedbackComponent from './FeedbackComponent';
import Link from 'next/link';
import { handleWebinarClick, handleDocumentClick } from '@/utils/tracking';
import { RequestsInProgressType, CustomLinkProps } from '@/interfaces/index_interface';
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
  const [requestsInProgress, setRequestsInProgress] = useState<RequestsInProgressType>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [errorreact, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
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
  const { messages, history } = messageState;
  const serverUrl = process.env.NODE_ENV === 'production' ? 'https://solidcam.herokuapp.com/' : LOCAL_URL;

  const roomIdRef = useRef<string | null>(roomId);
  const answerStartRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [textAreaHeight, setTextAreaHeight] = useState<string>('auto');
  const { submitTimeRef } = useSocket(serverUrl, roomId, setRequestsInProgress, setMessageState, setCurrentStage, setRoomId);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [shouldSubmitAfterTranscription, setShouldSubmitAfterTranscription] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<ImagePreviewData | null>(null);


  const {
    imagePreviews,
    handleFileChange,
    handleDeleteImage,
    setImagePreviews,
    uploadProgress: internalUploadProgress
  } = useFileUpload(setQuery, roomId, auth, setUploadStatus);

  const {
    homeImagePreviews,
    handleHomeFileChange,
    handleHomeDeleteImage,
    setHomeImagePreviews,
    fileInputRef,
    uploadProgress: homeUploadProgress,
    fileErrors
  } = useFileUploadFromHome(setQuery, roomId, auth, setUploadStatus);

  const { uploadProgress: pasteUploadProgress, clearPastedImagePreviews } = usePasteImageUpload(
    roomId,
    auth,
    textAreaRef,
    setHomeImagePreviews
  );

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

  const adjustTextAreaHeight = () => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      const baseHeight = 24;
      const newHeight = Math.min(textAreaRef.current.scrollHeight, 10 * baseHeight);
      textAreaRef.current.style.height = `${newHeight}px`;

      const offset = newHeight - baseHeight;
      textAreaRef.current.style.transform = `translateY(-${offset}px)`;
      setTextAreaHeight(`${newHeight}px`);

      document.documentElement.style.setProperty('--textarea-height', `${newHeight}px`);
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
  
    if (!trimmedQuery && currentStage !== 4 && homeImagePreviews.length === 0) {
      alert('Please input a question or upload an image');
      return;
    }
  
    if (requestsInProgress[roomId]) {
      return;
    }
  
    setRequestsInProgress(prev => ({ ...prev, [roomId]: true }));
    setUserHasScrolled(false);
    setLoading(true);
    const question = query.trim();
  
  
    setMessageState((state) => ({
      ...state,
      messages: [
        ...state.messages,
        {
          type: 'userMessage',
          message: question,
          isComplete: false,
          images: homeImagePreviews.slice(0, 3),
        },
      ],
      history: [...state.history, [question, ""]],
    }));
  
    setQuery('');
  
    const userEmail = auth.currentUser ? auth.currentUser.email : null;
  
    if (!userEmail) {
      console.error('User not authenticated');
      setLoading(false);
      setRequestsInProgress(prev => ({ ...prev, [roomId]: false }));
      return;
    }
  
    const imageUrls = homeImagePreviews.slice(0, 3).map(preview => preview.url);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': userEmail,
        },
        body: JSON.stringify({
          question,
          history,
          roomId,
          imageUrls,
          userEmail,
        }),
      });
  
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
  
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setError('An error occurred while fetching the data. Please try again.');
      console.error('error', error);
    } finally {
      setRequestsInProgress(prev => ({ ...prev, [roomId]: false }));
      setLoading(false);
      setHomeImagePreviews([]);
      clearPastedImagePreviews();

    }
  };

  useEffect(() => {
    const handleScrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    handleScrollToTop();

    return () => {};
  }, []);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    if (messageListRef.current && !userHasScrolled) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, userHasScrolled]);

  useEffect(() => {
    const handleScroll = () => {
      if (messageListRef.current) {
        const isAtBottom = messageListRef.current.scrollHeight - messageListRef.current.scrollTop === messageListRef.current.clientHeight;
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
      <Layout theme={theme} toggleTheme={toggleTheme}>
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
                  uploadProgress={pasteUploadProgress[image.fileName] || homeUploadProgress[image.fileName] || null}
                />
              ))}
            </div>
          )}

          {/*section to display file errors */}
          {Object.entries(fileErrors).length > 0 && (
            <div className="error-container">
              {Object.entries(fileErrors).map(([fileName, error]) => (
                <div key={fileName} className="border border-red-400 rounded-md p-2 mt-2">
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
                      let webinarCount = 1;
                      let documentCount = 1;
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
                      const hasSources = message.sourceDocs && message.sourceDocs.length > 0;
                      const totalWebinars = message.sourceDocs?.filter(doc => doc.metadata.type === 'youtube').length ?? 0;
                      const totalDocuments = message.sourceDocs?.length ?? 0 - totalWebinars;
                      return (
                        <React.Fragment key={`chatMessageFragment-${index}`}>
                        <div className={className}>
                          {icon}
                          <div className={styles.markdownanswer} ref={answerStartRef}>
                          {message.images && message.images.length > 0 && (
                            <div className="image-container" style={{ 
                              marginBottom: '10px', 
                              display: 'flex', 
                              flexWrap: 'wrap', 
                              gap: '10px',
                              justifyContent: 'start'
                            }}>
                              {message.images.map((image, imgIndex) => (
                                <div key={imgIndex} style={{ 
                                  width: '150px', 
                                  height: '150px', 
                                  overflow: 'hidden',
                                  position: 'relative'
                                }}>
                                  <img 
                                    src={image.url} 
                                    alt={`User uploaded: ${image.fileName}`} 
                                    style={{ 
                                      width: '100%', 
                                      height: '100%', 
                                      objectFit: 'cover',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => setEnlargedImage(image)}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                            <ReactMarkdown
                              components={{
                                a: (props: ComponentProps<'a'>) => <CustomLink {...props} />,
                              }}
                            >
                              {message.message}
                            </ReactMarkdown>
                          </div>
                        </div>
                          {message.sourceDocs && (
                            <div key={`sourceDocsAccordion-${index}`}>
                              <Accordion type="single" collapsible className="flex-col">
                                {message.sourceDocs.map((doc, docIndex) => {
                                  let title;
                                  let currentCount;
                                  if (doc.metadata.type === 'youtube') {
                                    title = 'Webinar';
                                    currentCount = webinarCount++;
                                  } else {
                                    title = 'Document';
                                    currentCount = documentCount++;
                                  }

                                  return (
                                    <AccordionItem key={`messageSourceDocs-${docIndex}`} value={`item-${docIndex}`}>
                                      <AccordionTrigger>
                                        <h3>{`${title} ${currentCount}`}</h3>
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
                                })}
                              </Accordion>
                            </div>
                          )}
                          {message.isComplete && <FeedbackComponent key={index} messageIndex={index} qaId={message.qaId} roomId={roomId} />}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            </main>
            <div className={styles.center}>
              <div className={styles.cloudform}>
              <form onSubmit={handleSubmit} className={styles.textareaContainer}>
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
                {!loading && (
                  <ImageUpload handleFileChange={handleFileChange} />
                )}
                
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
                    <label htmlFor="generalFileInput" className={styles.fileUploadButton} title="Upload image">
                      <Image src="/image-upload-48.png" alt="Upload JPG" width="30" height="30" />
                    </label>
                  </>
                )}
                
                {currentStage === 4 ? (
                  !loading && (
                    <label htmlFor="fileInput" className={styles.fileUploadButton}>
                      <input
                        id="fileInput"
                        type="file"
                        accept="image/jpeg"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                        multiple
                      />
                      <Image src="/image-upload-48.png" alt="Upload JPG" width="30" height="30" />
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
                      SolidCAM ChatBot may display inaccurate info so double-check its responses
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
