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
import useTheme from '@/hooks/useTheme'; // Import the custom hook
import usePasteImageUpload from '@/hooks/usePasteImageUpload'; // Import the new custom hook
import UploadStatusBanner from './UploadStatusBanner'; // Import the new banner component
import { RecordAudioReturnType, recordAudio, transcribeAudio } from '../utils/speechRecognition'; // Import the speech recognition helper and type

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
  // Use custom hook for theme management
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
  const [uploadStatus, setUploadStatus] = useState<string | null>(null); // Add uploadStatus state
  const { messages, history } = messageState;
  const serverUrl = process.env.NODE_ENV === 'production' ? 'https://solidcam.herokuapp.com/' : LOCAL_URL;

  // Refs
  const roomIdRef = useRef<string | null>(roomId);
  const answerStartRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [textAreaHeight, setTextAreaHeight] = useState<string>('auto');
  const { submitTimeRef } = useSocket(serverUrl, roomId, setRequestsInProgress, setMessageState, setCurrentStage, setRoomId);
  const { imagePreviews, handleFileChange, handleDeleteImage, setImagePreviews } = useFileUpload(setQuery, roomId, auth, setUploadStatus);

  usePasteImageUpload(currentStage, setImagePreviews, setQuery, roomId, auth);

  // Speech recognition state and handler
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);

  // Add this state
  const [recorder, setRecorder] = useState<RecordAudioReturnType | null>(null);
  const [shouldSubmitAfterTranscription, setShouldSubmitAfterTranscription] = useState<boolean>(false);

  const replaceCommonMisrecognitions = (text: any) => {
    type CorrectionsType = {
      [key: string]: string;
    };

    const corrections: CorrectionsType = {
      'Solid cup': 'SolidCAM',
      'Sonic on': 'SolidCAM',
      'solocam': 'SolidCAM',
      'Sonic car': 'SolidCAM',
      'Sonic come': 'SolidCAM',
      'Sonic coming': 'SolidCAM',
      // Add more corrections as needed
    };

    Object.keys(corrections).forEach((incorrect) => {
      const correct = corrections[incorrect];
      const regex = new RegExp(incorrect, 'gi');
      text = text.replace(regex, correct);
    });

    return text;
  };

  const handleMicClick = async () => {
    console.log('Mic clicked. Current state:', { listening, recorder });
    setSpeechError(null);
  
    try {
      if (!listening) {
        console.log('Starting recording...');
        const newRecorder = await recordAudio();
        console.log('New recorder created:', newRecorder);
        newRecorder.start();
        setRecorder(newRecorder);
        setListening(true);
        console.log('Recording started. New state:', { listening: true, recorder: newRecorder });
      } else {
        console.log('Stopping recording...');
        if (!recorder) {
          throw new Error('No recorder available');
        }
        const audioBlob = await recorder.stop();
        console.log('Recording stopped. Audio blob:', audioBlob);
        console.log('Transcribing audio...');
        const transcription = await transcribeAudio(audioBlob);
        console.log('Transcription received:', transcription);
        setQuery((prevQuery) => {
          const updatedQuery = `${prevQuery} ${transcription}`.trim();
          return updatedQuery;
        });
        setRecorder(null);
        setListening(false);
        setShouldSubmitAfterTranscription(true);
        console.log('Process completed. New state:', { listening: false, recorder: null });
      }
    } catch (err: any) {
      console.error('handleMicClick error:', err);
      setSpeechError(err.message || 'An error occurred');
      setListening(false);
      setRecorder(null);
      console.log('Error occurred. Reset state:', { listening: false, recorder: null });
    }
  };

  useEffect(() => {
    if (shouldSubmitAfterTranscription) {
      handleSubmit();
      setShouldSubmitAfterTranscription(false);
    }
  }, [query]);

  // Event Handlers
  useEffect(() => {
    adjustTextAreaHeight();
  }, [query]);

  useEffect(() => {
    adjustTextAreaHeight();
  }, []);

  const adjustTextAreaHeight = () => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto'; // Reset height to recalculate
      const baseHeight = 24; // Base single line height, adjust as needed
      const newHeight = Math.min(textAreaRef.current.scrollHeight, 10 * baseHeight);
      textAreaRef.current.style.height = `${newHeight}px`;

      // Move the textarea upwards by changing the bottom position
      const offset = newHeight - baseHeight; // Calculate how much taller than one line it is
      textAreaRef.current.style.transform = `translateY(-${offset}px)`;
      setTextAreaHeight(`${newHeight}px`);

      // Update the --textarea-height CSS variable
      document.documentElement.style.setProperty('--textarea-height', `${newHeight}px`);
    }
  };

  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow the shift+enter key to create a new line
        // By not calling e.preventDefault(), we allow the default behavior of adding a new line
      } else if (query) {
        // Prevent the default enter key behavior
        e.preventDefault();
        // Submit the form
        handleSubmit(e);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = e.target;
    if (currentStage === 4) {
      // Split the current query into lines
      const lines = value.split('\n');
      // Split the existing query into lines
      const existingLines = query.split('\n');

      // Check if any existing line (URL) is being edited
      const isEditingUrl = lines.some((line, index) => {
        const existingLine = existingLines[index] || '';
        return existingLine.startsWith('http') && line !== existingLine;
      });

      if (isEditingUrl) {
        return; // Prevent any change to URLs
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

    if (!trimmedQuery && currentStage !== 4) { // Allow empty text if in stage 4
      alert('Please input a question');
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
        },
      ],
      history: [...state.history, [question, ""]],
    }));

    setQuery('');

    // Fetch the user ID from the auth object, ensure user is authenticated
    const userEmail = auth.currentUser ? auth.currentUser.email : null;

    if (!userEmail) {
      console.error('User not authenticated');
      setLoading(false);
      setRequestsInProgress(prev => ({ ...prev, [roomId]: false }));
      return;
    }

    // Record the time of submission
    const currentTime = performance.now();
    submitTimeRef.current = currentTime;  // Use ref here

    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Optionally, include the userId in the Authorization header or within the body
          'Authorization': userEmail,
        },
        body: JSON.stringify({
          question,
          history,
          roomId,
          userEmail, // Including the userId in the body if not using the Authorization header
        }),
      });

      // Scroll to top or desired position after submission
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setError('An error occurred while fetching the data. Please try again.');
      console.error('error', error);
    } finally {
      // Reset the request state for the current room
      setRequestsInProgress(prev => ({ ...prev, [roomId]: false }));
      setLoading(false);
    }
  };

  // Ensure the page stays at the top on mobile
  useEffect(() => {
    const handleScrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Call the function when the component mounts
    handleScrollToTop();

    return () => {
      // Cleanup if necessary
    };
  }, []);

  // Effects

  useEffect(() => {
    roomIdRef.current = roomId; //to avoid heroku warning
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

  // Main Render
  return (
    <>
      <GoogleAnalytics /> {}
      <Layout theme={theme} toggleTheme={toggleTheme}>
        <div className="mx-auto flex flex-col gap-4">
          {imagePreviews.length > 0 && (
            <div className="image-container-image-thumb">
              {imagePreviews.map((image, index) => (
                <div key={index} className="image-wrapper" style={{ position: 'relative' }}>
                  <img
                    src={image.url}
                    alt={`Image Preview ${index + 1}`}
                    className="image-preview"
                    style={{ width: '150px', height: '150px', marginBottom: '10px' }}
                  />
                  <button onClick={() => handleDeleteImage(image.fileName, index)} className="delete-button" style={{ position: 'absolute', top: 0, right: 0 }}>
                    X
                  </button>
                </div>
              ))}
            </div>
          )}
          {uploadStatus && (
            <UploadStatusBanner status={uploadStatus} /> // Display the upload status banner
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
                      // Preprocess documents to update counts based on type
                      const totalWebinars = message.sourceDocs?.filter(doc => doc.metadata.type === 'youtube').length ?? 0;
                      const totalDocuments = message.sourceDocs?.length ?? 0 - totalWebinars; // Assuming other types are documents
                      return (
                        <React.Fragment key={`chatMessageFragment-${index}`}>
                          <div className={className}>
                            {icon}
                            <div className={styles.markdownanswer} ref={answerStartRef}>
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
                                    currentCount = webinarCount++; // Increment count for webinar
                                  } else { // 'PDF' and 'sentinel' are treated as documents
                                    title = 'Document';
                                    currentCount = documentCount++; // Increment count for document
                                  }

                                  return (
                                    <AccordionItem key={`messageSourceDocs-${docIndex}`} value={`item-${docIndex}`}>
                                      <AccordionTrigger>
                                        <h3>{`${title} ${currentCount}`}</h3>
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        {
                                          doc.metadata.type === 'youtube' ? (
                                            // YouTube link handling
                                            <p>
                                              <b>Source:</b>
                                              {doc.metadata.source ? <a href={doc.metadata.source} target="_blank" rel="noopener noreferrer" onClick={() => handleWebinarClick(doc.metadata.source)}>View Webinar</a> : 'Unavailable'}
                                            </p>
                                          ) : doc.metadata.type === 'sentinel' ? (
                                            // Sentinel link handling
                                            <p>
                                              <b>Source:</b>
                                              {doc.metadata.source ? <a href={doc.metadata.source} target="_blank" rel="noopener noreferrer" onClick={() => handleDocumentClick(doc.metadata.source)}>View</a> : 'Unavailable'}
                                            </p>
                                          ) : (
                                            // Default handling
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
                                                      // Extract all page numbers from the content
                                                      const pageNumbers = Array.from(doc.pageContent.matchAll(/\((\d+)\)/g), m => parseInt(m[1], 10));

                                                      // Find the largest page number mentioned
                                                      const largestPageNumber = pageNumbers.length > 0 ? Math.max(...pageNumbers) : null;

                                                      // Filter for numbers within 2 pages of the largest number, if it exists
                                                      let candidateNumbers = largestPageNumber !== null ? pageNumbers.filter(n => largestPageNumber - n <= 2) : [];

                                                      // From the filtered numbers, find the smallest one to use in the link
                                                      let smallestPageNumberInRange = candidateNumbers.length > 0 ? Math.min(...candidateNumbers) : null;

                                                      // If no suitable number is found within 2 pages of the largest, decide on fallback strategy
                                                      // For example, using the largest number or another logic
                                                      if (smallestPageNumberInRange === null && largestPageNumber !== null) {
                                                        // Fallback strategy here
                                                        // This example simply uses the largest number
                                                        smallestPageNumberInRange = largestPageNumber;
                                                      }
                                                      const pageLink = smallestPageNumberInRange !== null ? `${doc.metadata.source}#page=${smallestPageNumberInRange}` : doc.metadata.source;

                                                      // Detect if it's iOS
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
                      : 'Message SolidCAM ChatBot...'
                  }
                  value={query}
                  className={styles.textarea}
                  readOnly={currentStage === 4}
                />
                {currentStage === 4 && (
                  <label htmlFor="fileInput" className={styles.fileUploadButton}>
                    <input
                      id="fileInput"
                      type="file"
                      accept="image/jpeg"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                      multiple
                    />
                    <img src="/icons8-image-upload-48.png" alt="Upload JPG" style={{ width: '30px', height: '30px' }} />
                  </label>
                )}
                <button
                  type="submit"
                  id="submitButton"
                  disabled={loading}
                  className={styles.generatebutton}
                >
                  {loading ? (
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
                <label htmlFor="micInput" className={styles.micButton}>
                  <input
                    id="micInput"
                    type="button"
                    style={{ display: 'none' }}
                    onClick={handleMicClick}
                  />
                  <img
                    src="/icons8-mic-50.png"
                    alt="Mic"
                    style={{ width: '30px', height: '30px', opacity: listening ? 0.5 : 1 }}
                  />
                </label>
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
}

export default Home;
