//index.tsx
import React, { useRef, useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { io } from "socket.io-client";
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import Layout from '@/components/layout';
import LoadingDots from '@/components/ui/LoadingDots';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import { MyDocument } from 'utils/GCSLoader';

type RequestsInProgressType = {
  [key: string]: boolean;
};

interface DocumentWithMetadata {
  metadata: {
    source: string;
  };
}

// Constants
const DEFAULT_THEME = 'light';
const PRODUCTION_ENV = 'production';
const LOCAL_URL = 'http://localhost:3000';
const PRODUCTION_URL = 'https://solidcam.herokuapp.com/';

// Image URLs
let imageUrlUserIcon = '/usericon.png';
let botimageIcon = '/bot-image.png';

if (process.env.NODE_ENV === PRODUCTION_ENV) {
  imageUrlUserIcon = `${PRODUCTION_URL}usericon.png`;
  botimageIcon = `${PRODUCTION_URL}bot-image.png`;
}

// Utility Functions
function getTitleByDocType(docType: string): string {
  switch (docType) {
      case 'youtube':
          return 'Webinar';
      case 'sentinel':
          return 'Help Document';
      default:
          return 'Help Document';
  }
}

function addHyperlinksToPageNumbers(content: string, source: string): string {
  const regex = /\((\d+)\)/g;
  return content.replace(regex, (match, pageNumber) => {
    let link = `${source}#page=${pageNumber}`;
    if (link.includes('&')) {
      link = link.replace(/&/g, 'and');
    }
    return `<a href="${link}" target="_blank" rel="noopener noreferrer" style="color: blue;">${match}</a>`;
  });
}


// Component: Home
export default function Home() {
    // State Hooks
    const { user, error, isLoading } = useUser();
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
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
        messages: [
        {
            message: 'Hi, what would you like to learn about SolidCAM?',
            type: 'apiMessage',
            isComplete:false,
        },
        ],
        history: [],
    });
    const { messages, history } = messageState;
    const [feedback, setFeedback] = useState<FeedbackState>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeMessageIndex, setActiveMessageIndex] = useState<number | null>(null);

    // Refs
    const roomIdRef = useRef(roomId);
    const answerStartRef = useRef<HTMLDivElement>(null);
    const messageListRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    // Event Handlers
    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === DEFAULT_THEME ? 'dark' : DEFAULT_THEME);
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
  

    const handleFeedback = (messageIndex: number, type: string) => {
        setFeedback(prev => ({ ...prev, [messageIndex]: { ...prev[messageIndex], type } }));
    };

    const handleSubmitRemark = async (messageIndex : any, remark : any) => {
        //console.log(`Attempting to submit feedback for messageIndex: ${messageIndex}`);
        //console.log("Message at this index:", messages[messageIndex]);
        //console.log("Feedback state at messageIndex:", feedback[messageIndex]);
        // Retrieve the feedback type ('up' or 'down') and the qaId from the message
        const feedbackType = feedback[messageIndex]?.type;
        const qaId = messages[messageIndex]?.qaId;
    
        // Ensure qaId is present
        if (!qaId) {
        console.error("No qaId found for message index " + messageIndex);
        return;
        }
    
        // Send this information to the server
        try {
        const response = await fetch('/api/submit-feedback', {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            },
            body: JSON.stringify({
            qaId: qaId,
            thumb: feedbackType,
            comment: remark,
            roomId: roomId,
            }),
        });
    
        if (response.ok) {
            // Handle successful feedback submission
            setFeedback((prev) => ({
            ...prev,
            [messageIndex]: {
                ...prev[messageIndex],
                remark: '',
                type: undefined,
            },
            }));
            setIsModalOpen(false);
        } else {
            // Check if the response is empty
            const text = await response.text();
            if (text.trim() === "") {
            console.error('Failed to submit feedback: Empty response');
            } else {
            try {
                // Attempt to parse response as JSON
                const data = JSON.parse(text);
                if (data && data.message) {
                console.error('Failed to submit feedback:', data.message);
                } else {
                console.error('Failed to submit feedback: Invalid response');
                }
            } catch (jsonError) {
                console.error('Failed to parse server response as JSON:', (jsonError as Error).message);
            }
            }
        }
        } catch (error) {
        if (error instanceof TypeError) {
            console.error('Network error when submitting feedback:', (error as Error).message);
        } else {
            console.error('Error when submitting feedback:', (error as Error).message);
        }
        }
    };

    const handleSubmit = async (e: any) => {
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
            isComplete:false,
            },
        ],
        history: [...state.history, [question, ""]],
        }));

        setQuery('');

        try {
        await fetch('/api/chat', {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            },
            body: JSON.stringify({
            question,
            history,
            roomId,
            }),
        });

      } catch (errorreact) {
        setLoading(false);
        setError('An error occurred while fetching the data. Please try again.');
        console.log('error', errorreact);
      } finally {
        // Reset the request state for the current room
        setRequestsInProgress(prev => ({ ...prev, [roomId]: false }));
        setLoading(false);
    }
    };

    // Effects

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
        const handleFullResponse = (response : any) => {
          setMessageState((state) => {
            const { sourceDocs, qaId } = response;
    
            const deduplicatedDocs = sourceDocs.reduce((acc: DocumentWithMetadata[], doc: DocumentWithMetadata) => {
              const sourceURL = doc.metadata.source;
              const timestamp = sourceURL.match(/t=(\d+)s$/)?.[1];
            
              if (timestamp && !acc.some((d: DocumentWithMetadata) => d.metadata.source.includes(`t=${timestamp}s`))) {
                acc.push(doc);
              } else if (!timestamp) {
                acc.push(doc);
              }
              return acc;
            }, []);
    
            const updatedMessages = state.messages.map((message, index, arr) => {
              if (index === arr.length - 1 && message.type === 'apiMessage') {
                const updatedMessage = `${message.message}<br/><br/>
                <span style="color: red;"><strong>Don't forget to rate the response and leave comments to help debug the application!</strong></span>
                <br/><br/><span style="color: red;">If the answer is wrong and you know the answer to the question, feel free to add it!</span>`;
                return { ...message, message: updatedMessage, sourceDocs: deduplicatedDocs, qaId: qaId, isComplete:true };
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

    // Component: FeedbackComponent
    const FeedbackComponent: React.FC<FeedbackComponentProps> = ({ messageIndex }) => {
        const handleOpenModal = (type: string) => {
        //console.log("Opening modal for message index", messageIndex);
        setActiveMessageIndex(messageIndex);
    
        handleFeedback(messageIndex, type);
        setIsModalOpen(true);
        };
    
        return (
        <div className="feedback-container">
            <button onClick={() => handleOpenModal('up')}>👍</button>
            <button onClick={() => handleOpenModal('down')}>👎</button>
        </div>
        );
    };

  // Component: RemarksModal
  const RemarksModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    messageIndex: number | null;
    onSubmit: (messageIndex: number | null, remark: string) => void;
  }> = ({ isOpen, onClose, messageIndex, onSubmit }) => {
    const [remark, setRemark] = useState('');
  
    const submitRemark = () => {
      //console.log("Submitting remark for activeMessageIndex", activeMessageIndex);
      if (activeMessageIndex != null) {
        handleSubmitRemark(activeMessageIndex, remark);
        setRemark('');  // Clear the remark
      }
      onClose(); // Close the modal after submission
    };
  
    if (!isOpen) return null;
  
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <div className="modal-header">
            <h2>Provide additional feedback</h2>
            <span className="close" onClick={onClose}>&times;</span>
          </div>
          <div className="modal-body">
            <p>What do you like about the response?</p>
            <textarea 
              placeholder="Your remarks..." 
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            ></textarea>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={submitRemark}>Submit feedback</button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) return <div></div>;
  if (error) return <div>{error.message}</div>;

  // Main Render
  if (user) {
    return (
      <>
        <Layout theme={theme} toggleTheme={toggleTheme}>
          <div className="mx-auto flex flex-col gap-4">
            <h1 className="text-2xl font-bold leading-[1.1] tracking-tighter text-center">
              Chat With SolidCAM Docs
            </h1>
            <main className={styles.main}>
              <div className={styles.cloud}>
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
                  const hasSources = message.sourceDocs && message.sourceDocs.length > 0;
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
                          <Accordion
                            type="single"
                            collapsible
                            className="flex-col"
                          >
                            {message.sourceDocs.map((doc, docIndex) => (
                              <div key={`messageSourceDocs-${docIndex}`}>
                                <AccordionItem value={`item-${docIndex}`}>
                                  <AccordionTrigger>
                                    <h3>{getTitleByDocType(doc.metadata.type)}</h3>
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
                                              ? <a href={doc.metadata.source} target="_blank" rel="noopener noreferrer">View</a>
                                              : 'Unavailable'
                                            }
                                          </p>
                                        </>
                                      )
                                    }
                                  </AccordionContent>
                                </AccordionItem>
                              </div>
                            ))}
                          </Accordion>
                        </div>
                      )}
                      {message.isComplete && <FeedbackComponent messageIndex={index} />}
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
                          : 'What SolidCAM can do?'
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
          <footer className="m-auto p-4">
          </footer>
        </Layout>
        <RemarksModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          messageIndex={activeMessageIndex}
          onSubmit={handleSubmitRemark}
        />
      </>
    )
  }
  if (typeof window !== 'undefined') {
    window.location.href = "/api/auth/login";
    return null;
  }
  return null;
};

// Supporting Interfaces
interface FeedbackState {
  [key: number]: {
    type?: string;
    remark?: string;
  };
}

interface FeedbackComponentProps {
  messageIndex: number;
}