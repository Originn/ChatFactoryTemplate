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
import { MyDocument } from 'utils/GCSLoader';

type RequestsInProgressType = {
  [key: string]: boolean;
};

interface DocumentWithMetadata {
  metadata: {
    source: string;
    // Add other properties of metadata here if needed
  };
  // Add other properties of the document here if needed
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
function addHyperlinksToPageNumbers(content: string, source: string): string {
  const regex = /\((\d+)\)/g;
  return content.replace(regex, (match, pageNumber) => {
    const link = `${source}#page=${pageNumber}`;
    return `<a href="${link}" target="_blank" rel="noopener noreferrer" style="color: blue;">${match}</a>`;
  });
}

// Component: Home
export default function Home() {
    // State Hooks
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [query, setQuery] = useState<string>('');
    const [requestsInProgress, setRequestsInProgress] = useState<RequestsInProgressType>({});
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
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
        },
        ],
        history: [],
    });
    const { messages, history } = messageState;
    const [feedback, setFeedback] = useState<FeedbackState>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeMessageIndex, setActiveMessageIndex] = useState<number | null>(null);

    // Refs
    const answerStartRef = useRef<HTMLDivElement>(null);
    const messageListRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    // Event Handlers
    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === DEFAULT_THEME ? 'dark' : DEFAULT_THEME);
    };

    const handleEnter = (e: any) => {
        if (e.key === 'Enter' && query) {
        handleSubmit(e);
        } else if (e.key == 'Enter') {
        e.preventDefault();
        }
    };

    const handleFeedback = (messageIndex: number, type: string) => {
        setFeedback(prev => ({ ...prev, [messageIndex]: { ...prev[messageIndex], type } }));
    };

    const handleSubmitRemark = async (messageIndex : any, remark : any) => {
        console.log(`Attempting to submit feedback for messageIndex: ${messageIndex}`);
        console.log("Message at this index:", messages[messageIndex]);
        console.log("Feedback state at messageIndex:", feedback[messageIndex]);
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

      } catch (error) {
        setLoading(false);
        setError('An error occurred while fetching the data. Please try again.');
        console.log('error', error);
      } finally {
        // Reset the request state for the current room
        setRequestsInProgress(prev => ({ ...prev, [roomId]: false }));
        setLoading(false);
    }
    };

    // Effects
    const roomIdRef = useRef(roomId);
    useEffect(() => {
      roomIdRef.current = roomId; //to avoid heroku warning
      const serverUrl = process.env.NODE_ENV === 'production' ? 'https://solidcam.herokuapp.com/' : LOCAL_URL;
      const socket = io(serverUrl);
    
      // Event handler for 'assignedRoom'
      const handleAssignedRoom = (assignedRoomId : any) => {
        setRoomId(assignedRoomId);
        setRequestsInProgress(prev => ({ ...prev, [assignedRoomId]: false }));
    
        // Listener for 'fullResponse' event specific to the assigned room
        const responseEventName = `fullResponse-${assignedRoomId}`;
        const handleFullResponse = (response : any) => {
          setMessageState((state) => {
            const filterScore = parseFloat(process.env.NEXT_PUBLIC_FILTER_SCORE || "0.81");
            const { sourceDocs, qaId } = response;
    
            const filteredSourceDocs = sourceDocs ? sourceDocs.filter((doc : any) => {
              const score = parseFloat(doc.metadata.score);
              return !isNaN(score) && score >= filterScore;
            }) : [];
    
            const deduplicatedDocs = filteredSourceDocs.reduce((acc: DocumentWithMetadata[], doc: DocumentWithMetadata) => {
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
                return { ...message, sourceDocs: deduplicatedDocs, qaId: qaId };
              }
              return message;
            });
    
            return { ...state, messages: updatedMessages };
          });
        };
    
        // Attach the event listener for 'fullResponse'
        socket.on(responseEventName, handleFullResponse);
    
        // Return a cleanup function for this dynamic listener
        return () => socket.off(responseEventName, handleFullResponse);
      };
    
      socket.on('assignedRoom', handleAssignedRoom);
      socket.on('connect_error', (error) => console.log('Connection Error:', error));
    
      // Listener for 'newToken'
      socket.on("newToken", (token) => {
        setMessageState((state) => {
          const lastMessage = state.messages[state.messages.length - 1];
          if (lastMessage && lastMessage.type === 'apiMessage') {
            return {
              ...state,
              messages: [
                ...state.messages.slice(0, -1),
                { ...lastMessage, message: lastMessage.message + token },
              ],
            };
          }
          return {
            ...state,
            messages: [...state.messages, { type: 'apiMessage', message: token }],
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
        window.localStorage.setItem('theme', theme);
        document.body.className = theme;
    }, [theme]);

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

    useEffect(() => {
        const savedTheme = window.localStorage.getItem('theme') as 'light' | 'dark' | null;
        if (savedTheme) {
            setTheme(savedTheme);
        } else {
            window.localStorage.setItem('theme', DEFAULT_THEME);
        }
    }, []);

    // Component: FeedbackComponent
    const FeedbackComponent: React.FC<FeedbackComponentProps> = ({ messageIndex }) => {
        const handleOpenModal = (type: string) => {
        console.log("Opening modal for message index", messageIndex);
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
      console.log("Submitting remark for activeMessageIndex", activeMessageIndex);
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

  // Main Render
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
                      <div
                        className="p-5"
                        key={`sourceDocsAccordion-${index}`}
                      >
                        <Accordion
                          type="single"
                          collapsible
                          className="flex-col"
                        >
                          {message.sourceDocs.map((doc, docIndex) => (
                            <div key={`messageSourceDocs-${docIndex}`}>
                              <AccordionItem value={`item-${docIndex}`}>
                                <AccordionTrigger>
                                  <h3>{doc.metadata.type === 'youtube' ? 'Webinar' : 'Help Document'}</h3>
                                </AccordionTrigger>
                                <AccordionContent>
                                  {
                                    // Add your logic to determine if the content is from a webinar
                                    doc.metadata.source.includes("youtube")
                                    ? (
                                      <p>
                                        <b>Source:</b>
                                        {
                                          doc.metadata && doc.metadata.source
                                          ? <a href={doc.metadata.source} target="_blank" rel="noopener noreferrer">View Webinar</a>
                                          : 'Unavailable'
                                        }
                                      </p>
                                    )
                                    : (
                                      <>
                                        <ReactMarkdown
                                          rehypePlugins={[rehypeRaw as any]}
                                          components={{
                                            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />
                                          }}
                                        >
                                          {addHyperlinksToPageNumbers(doc.pageContent, doc.metadata.source)}
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
                    {hasSources && <FeedbackComponent messageIndex={index} />}
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
            {error && (
              <div className="border border-red-400 rounded-md p-4">
                <p className="text-red-500">{error}</p>
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
