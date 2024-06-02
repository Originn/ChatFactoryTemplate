//pages\index.tsx
import React, { useRef, useState, useEffect } from 'react';
import { io } from "socket.io-client";
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import Layout from '@/components/layout';
import LoadingDots from '@/components/ui/LoadingDots';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import { auth } from "@/utils/firebase";
import FeedbackComponent from '@/components/FeedbackComponent';
import Link from 'next/link';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { handleWebinarClick, handleDocumentClick, measureFirstTokenTime } from '@/utils/tracking';


type RequestsInProgressType = {
  [key: string]: boolean;
};

interface DocumentWithMetadata {
  metadata: {
    source: string;
  };
}

// Constants
const PRODUCTION_ENV = 'production';
const LOCAL_URL = 'http://localhost:3000';
const PRODUCTION_URL = 'https://solidcam.herokuapp.com/';

// Image URLs
let imageUrlUserIcon = '/usericon.png';
let botimageIcon = '/solidcam.png';

if (process.env.NODE_ENV === PRODUCTION_ENV) {
  imageUrlUserIcon = `${PRODUCTION_URL}usericon.png`;
  botimageIcon = `${PRODUCTION_URL}solidcam.png`;
}

// Component: Home
export default function Home() {
  // State Hooks
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
  });
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
  const [firstTokenTimes, setFirstTokenTimes] = useState<{ [key: string]: number | null }>({});
  const { messages, history } = messageState;

  // Refs
  const roomIdRef = useRef<string | null>(null);
  const answerStartRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [textAreaHeight, setTextAreaHeight] = useState<string>('auto');
  const [imagePreviews, setImagePreviews] = useState<{ url: string, fileName: string }[]>([]);
  const submitTimeRef = useRef<number | null>(null);
  const firstTokenCalculatedRef = useRef<{ [key: string]: boolean }>({});



  // Event Handlers

  useEffect(() => {
    adjustTextAreaHeight();
  }, [query]);

  useEffect(() => {
    adjustTextAreaHeight();
  }, []);

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      if (currentStage !== 4) {
        return;
      }
  
      const items = event.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.indexOf("image") !== -1) {
            const blob = item.getAsFile();
            if (blob) {
              const formData = new FormData();
              formData.append("file", blob);
  
              // Include the header in the form data
              const header = sessionStorage.getItem('header') || 'default-header';
              formData.append("header", header);
  
              const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
              });
  
              const data = await response.json();
              if (data.imageUrls) {
                data.imageUrls.forEach(({ url, fileName }: { url: string, fileName: string }) => {
                  setImagePreviews(prevPreviews => [...prevPreviews, { url, fileName }]);
                  setQuery(prevQuery => `${prevQuery}\n${url}`);
                });
                
                // Send the image URL with a specific payload structure to differentiate it from regular questions
                await fetch('/api/chat', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    imageUrl: data.imageUrl, // Ensure this key matches what the server expects
                    roomId, // Make sure roomId is always sent
                    userEmail: auth.currentUser?.email || 'default-email',
                  }),
                });
              }
            }
          }
        }
      }
    };
  
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [currentStage]);
  
  
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

const handleDeleteImage = async (fileName: string, index: number) => {
  try {
    const response = await fetch('/api/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName }),
    });

    if (response.ok) {
      // Remove the image from the state
      setImagePreviews(prevPreviews => prevPreviews.filter((_, i) => i !== index));
      // Remove the URL from the query
      setQuery(prevQuery => prevQuery.replace(new RegExp(`\\n?${imagePreviews[index].url}`), ''));
    } else {
      console.error('Failed to delete image from GCP');
    }
  } catch (error) {
    console.error('Error deleting image:', error);
  }
};

const toggleTheme = () => {
  // Update the theme in state and also save the new theme preference in localStorage
  const newTheme = theme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
  localStorage.setItem('theme', newTheme);
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

const handleSubmit = async (e: any) => {
  e.preventDefault();
  setError(null);

  const trimmedQuery = query.trim();

  if (!trimmedQuery && currentStage !== 4) { // Allow empty text if in stage 4
    alert('Please input a question');
    return;
  }

  if (roomId === null) {
    console.error('No roomId available');
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

  } catch (error) {
    setError('An error occurred while fetching the data. Please try again.');
    console.error('error', error);
  } finally {
    // Reset the request state for the current room
    setRequestsInProgress(prev => ({ ...prev, [roomId]: false }));
    setLoading(false);
  }
};





// New function to handle file selection
const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const files = event.target.files;
  if (files && files.length > 0) {
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);

      // Include the header in the form data
      const header = sessionStorage.getItem('header') || 'default-header';
      formData.append("header", header);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.imageUrls) {
        data.imageUrls.forEach(({ url, fileName }: { url: string, fileName: string }) => {
          setImagePreviews(prevPreviews => [...prevPreviews, { url, fileName }]);
          setQuery(prevQuery => `${prevQuery}\n${url}`);
        });

        // Send the image URL with a specific payload structure to differentiate it from regular questions
        await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageUrl: data.imageUrl, // Ensure this key matches what the server expects
            roomId, // Make sure roomId is always sent
            userEmail: auth.currentUser?.email || 'default-email',
          }),
        });
      }
    }
  }
};


// Effects

useEffect(() => {
  const handleStorageChange = () => {
      // Update theme based on localStorage value if it changes
      const updatedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
      setTheme(updatedTheme);
  };

  window.addEventListener('storage', handleStorageChange);

  return () => {
      window.removeEventListener('storage', handleStorageChange);
  };
}, []);

useEffect(() => {
  const savedTheme = window.localStorage.getItem('theme') as 'light' | 'dark' | null;
  if (savedTheme) {
      setTheme(savedTheme);
  } else {
      window.localStorage.setItem('theme', 'light');
  }
}, []);

useEffect(() => {
  window.localStorage.setItem('theme', theme);
  document.body.className = theme;
}, [theme]);


useEffect(() => {
  roomIdRef.current = roomId; //to avoid heroku warning
  const serverUrl = process.env.NODE_ENV === 'production' ? 'https://solidcam.herokuapp.com/' : LOCAL_URL;
  const socket = io(serverUrl);

  // Event handler for 'assignedRoom'
  const handleAssignedRoom = (assignedRoomId: string) => {
    setRoomId(assignedRoomId);
    roomIdRef.current = assignedRoomId; // Set the ref
    setRequestsInProgress(prev => ({ ...prev, [assignedRoomId]: false }));
  
    const responseEventName = `fullResponse-${assignedRoomId}`;
    const handleFullResponse = (response: any) => {
      setMessageState((state) => {
        const { sourceDocs, qaId } = response;
  
        const deduplicatedDocs = sourceDocs.reduce((acc: DocumentWithMetadata[], doc: DocumentWithMetadata) => {
          const sourceURL = doc.metadata.source;
          const timestamp = sourceURL.match(/t=(\d+)s$/)?.[1];
          // For other documents, use the original deduplication logic
          if (timestamp && !acc.some((d: DocumentWithMetadata) => d.metadata.source.includes(`t=${timestamp}s`))) {
            acc.push(doc);
          } else if (!timestamp) {
            acc.push(doc);
          }
  
          return acc;
        }, []);
  
        const updatedMessages = state.messages.map((message, index, arr) => {
          if (index === arr.length - 1 && message.type === 'apiMessage') {
            return { ...message, sourceDocs: deduplicatedDocs, qaId: qaId, isComplete: true };
          }
          return message;
        });
  
        return { ...state, messages: updatedMessages };
      });
  
      // Reset the firstTokenCalculatedRef for the current roomId
      firstTokenCalculatedRef.current[assignedRoomId] = false;
    };
  
    socket.on(responseEventName, handleFullResponse);
  
    return () => socket.off(responseEventName, handleFullResponse);
  };
  

  socket.on('assignedRoom', handleAssignedRoom);
  socket.on('connect_error', (errorreact) => console.log('Connection Error:', errorreact));


    socket.on('stageUpdate', (newStage: number) => {
      setCurrentStage(newStage);
    });

    socket.on('storeHeader', (header: string) => {
      sessionStorage.setItem('header', header);
    });

    socket.on("removeThumbnails", () => {
      const thumbnailElement = document.querySelector('.image-container-image-thumb');
      if (thumbnailElement) {
        thumbnailElement.remove();
      }
    });

    socket.on("resetStages", () => {
      setCurrentStage(null);
    });

  // Listener for 'newToken'
  socket.on("newToken", (token, isLastToken) => {
    setMessageState((state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage && lastMessage.type === 'apiMessage') {
        return {
          ...state,
          messages: [
            ...state.messages.slice(0, -1),
            { ...lastMessage, message: lastMessage.message + token, isComplete: isLastToken },
          ],
        };
      }
      return {
        ...state,
        messages: [...state.messages, { type: 'apiMessage', message: token, isComplete: isLastToken }],
      };
    });
  
    const currentRoomId = roomIdRef.current as string;
  
    // Record the first token arrival time if it hasn't been recorded yet
    if (!firstTokenTimes[currentRoomId] && !firstTokenCalculatedRef.current[currentRoomId]) {
      const currentTime = performance.now();
      setFirstTokenTimes(prevTimes => {
        return { ...prevTimes, [currentRoomId]: currentTime };
      });
  
      if (submitTimeRef.current) {
        const timeDifference = currentTime - submitTimeRef.current;
        console.log('timeDifference:', timeDifference);
        measureFirstTokenTime(timeDifference);
      }
  
      // Mark this roomId as having the first token calculated
      firstTokenCalculatedRef.current[currentRoomId] = true;
    } else {
    }
  });
  
  
  

  // Cleanup function for when the component unmounts
  return () => {
    socket.off('assignedRoom', handleAssignedRoom);
    socket.off('connect_error');
    socket.off('newToken');
    socket.off('stageUpdate');
    socket.off('storeHeader');
    socket.off('resetStages');
    if (roomId) {
      setRequestsInProgress(prev => {
        const updated = { ...prev };
        delete updated[roomId];
        return updated;
      });
    }
    socket.disconnect();
  };
}, []); // Empty dependency array to ensure this runs only on mount and unmount


useEffect(() => {
    textAreaRef.current?.focus();
}, []);


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
                          rehypePlugins={[rehypeRaw as any]}
                          components={{
                            a: ({ node, ...props }) => {
                              const isWebinar = props.href && props.href.includes('youtube.com'); // Assuming webinar links are YouTube URLs
                              return (
                                <a
                                  {...props}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => {
                                    if (isWebinar) {
                                      handleWebinarClick(props.href || '');
                                    } else {
                                      handleDocumentClick(props.href || '');
                                    }
                                  }}
                                />
                              );
                            }
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
                                            rehypePlugins={[rehypeRaw as any]}
                                            components={{
                                              a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" onClick={() => handleDocumentClick(props.href || '')} />
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

                                                  return <a href={pageLink} target="_blank" rel="noopener noreferrer" onClick={() => handleDocumentClick(pageLink)}>View Page</a>;
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
              </form>
              <div className={styles.warning}>
                <p style={{ fontSize: 'small', color: 'gray' }}>
                  SolidCAM ChatBot may display inaccurate info so double-check its responses
                </p>
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
