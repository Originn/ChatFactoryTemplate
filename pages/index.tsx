//index.tsx
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
import  FeedbackComponent from '@/components/FeedbackComponent';

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
      // Try to get the saved theme from localStorage or default to 'light'
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
    const { messages, history } = messageState;

    // Refs
    const roomIdRef = useRef(roomId);
    const answerStartRef = useRef<HTMLDivElement>(null);
    const messageListRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    // Event Handlers
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

    const handleSubmit = async (e : any) => {
      e.preventDefault();
      setError(null);
    
      if (!query) {
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
      const handleAssignedRoom = (assignedRoomId : any) => {
        setRoomId(assignedRoomId);
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
                      
                      return { ...message, sourceDocs: deduplicatedDocs, qaId: qaId, isComplete:true };
                  }
                  return message;
              });
      
              return { ...state, messages: updatedMessages };
          });
      };
      
    
        socket.on(responseEventName, handleFullResponse);
    
        return () => socket.off(responseEventName, handleFullResponse);
      };
    
      socket.on('assignedRoom', handleAssignedRoom);
      socket.on('connect_error', (errorreact) => console.log('Connection Error:', errorreact));
    
      // Listener for 'newToken'
      socket.on("newToken", (token) => {
        setMessageState((state) => {
          const lastMessage = state.messages[state.messages.length - 1];
          if (lastMessage && lastMessage.type === 'apiMessage') {
            return {
              ...state,
              messages: [
                ...state.messages.slice(0, -1),
                { ...lastMessage, message: lastMessage.message + token, isComplete: false },
              ],
            };
          }
          return {
            ...state,
            messages: [...state.messages, { type: 'apiMessage', message: token, isComplete: false }],
          };
        });
      });
      
    
      // Cleanup function for when the component unmounts
      return () => {
        socket.off('assignedRoom', handleAssignedRoom);
        socket.off('connect_error');
        socket.off('newToken');
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
        <Layout theme={theme} toggleTheme={toggleTheme}>
          <div className="mx-auto flex flex-col gap-4">
            <h1 className="text-2xl font-bold leading-[1.1] tracking-tighter text-center">
              SolidCAM ChatBot
            </h1>
            <main className={styles.main}>
              <div className={styles.cloud}>
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
                              a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />
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
                                            {doc.metadata.source ? <a href={doc.metadata.source} target="_blank" rel="noopener noreferrer">View Webinar</a> : 'Unavailable'}
                                        </p>
                                    ) : doc.metadata.type === 'sentinel' ? (
                                        // Sentinel link handling
                                        <p>
                                            <b>Source:</b>
                                            {doc.metadata.source ? <a href={doc.metadata.source} target="_blank" rel="noopener noreferrer">View</a> : 'Unavailable'}
                                        </p>
                                        
                                    ) : (
                                        // Default handling
                                        <>
                                          <ReactMarkdown
                                            rehypePlugins={[rehypeRaw as any]}
                                            components={{
                                              a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />
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

                                                  return <a href={pageLink} target="_blank" rel="noopener noreferrer">View Page</a>;
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
                      {message.isComplete && <FeedbackComponent key={index} messageIndex={index} qaId={message.qaId} roomId={roomId} /> }
                    </React.Fragment>
                  );
                })}

                </div>
              </div>
              <div className={styles.center}>
                <div className={styles.cloudform}>
                  <form onSubmit={handleSubmit}>
                    <textarea
                      disabled={loading}
                      onKeyDown={handleEnter}
                      ref={textAreaRef}
                      autoFocus={false}
                      rows={1}
                      maxLength={512}
                      id="userInput"
                      name="userInput"
                      placeholder={
                        loading
                          ? 'Waiting for response...'
                          : 'Message SolidCAM ChatBot...'
                      }
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className={styles.textarea}
                    />
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
                </div>
              </div>
              {errorreact && (
                <div className="border border-red-400 rounded-md p-4">
                  <p className="text-red-500">{errorreact}</p>
                </div>
              )}
            </main>
          </div>
        <footer className="footer m-auto p-4 text-center">
          © 2024 SolidCAM™. All rights reserved.
        </footer>
        </Layout>
      </>
    )
  }