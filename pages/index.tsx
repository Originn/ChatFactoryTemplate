//index.tsx
import React, { useRef, useState, useEffect } from 'react';
import { io } from "socket.io-client";
import Layout from '@/components/layout';
import LoadingDots from '@/components/ui/LoadingDots';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import { auth } from "@/utils/firebase";
import FeedbackModal from '@/components/FeedbackModal';
import MessageList from '@/components/MessageList';
import FileUpload from '@/components/FileUpload';
import { useTheme } from '@/utils/useTheme'; // Adjust path as necessary

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
    const [theme, setTheme] = useTheme('light');
    const [query, setQuery] = useState<string>('');
    const [requestsInProgress, setRequestsInProgress] = useState<RequestsInProgressType>({});
    const [loading, setLoading] = useState<boolean>(false);
    const [file, setFile] = useState<File | null>(null); // State to hold the uploaded file
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [bucketUrl, setBucketUrl] = useState<string | null>(null);
    const [errorreact, setError] = useState<string | null>(null);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [userHasScrolled, setUserHasScrolled] = useState(false);
    const [feedbackType, setFeedbackType] = useState('');
    const [messageState, setMessageState] = useState<{
        messages: Message[];
        history: [string, string][];
        pendingSourceDocs?: Document[];
    }>({
        messages: [],
        history: [],
    });
    const { messages, history } = messageState;
    const [feedback, setFeedback] = useState<FeedbackState>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeMessageIndex, setActiveMessageIndex] = useState<number | null>(null);

    // Refs
    const roomIdRef = useRef(roomId);
    const messageListRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null); // Ref for the file input

    // File input change handler
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files ? event.target.files[0] : null;
      if (!selectedFile) {
        setError("No file selected");
        return;
      }

      setFile(selectedFile);
      setError(null); // Clear any previous errors

      // Preview image locally before upload
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const blob = new Blob([selectedFile], { type: selectedFile.type });
          const blobUrl = URL.createObjectURL(blob); // Create a local URL
          setFilePreview(blobUrl); // Set local preview URL
          uploadImage(selectedFile); // Trigger upload after setting the preview
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setFilePreview(null); // Reset preview if not an image
      }
    };

    
    // Event Handlers
    const toggleTheme = () => {
      const newTheme = theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
    };

  const removeImage = async () => {
    if (!file) {
      console.error("No file to delete");
      alert("No file selected to delete");
      return;
    }
  
    try {
      const response = await fetch('/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: file.name }), // Ensure this matches the expected format on the server
      });
  
      if (!response.ok) {
        throw new Error(await response.text());
      }
  
      const result = await response.json();
      console.log("Image deleted successfully:", result.message);
      setFile(null);
      setFilePreview(null);
      setUploadProgress(null);
    } catch (error : any) {
      console.error("Error deleting image:", error);
      alert(`Error deleting image: ${error.message}`);
    }
  };
  

  const uploadImage = async (file: File) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
  
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/upload');
  
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          setUploadProgress(progress);  // Update upload progress
        }
      };
  
      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.response);
          console.log('File uploaded successfully:', data.url);
          setBucketUrl(data.url);  // Save the URL from the bucket here
          setUploadProgress(null);  // Reset the upload progress to hide the indicator
        } else {
          throw new Error('Upload failed with status: ' + xhr.status);
        }
      };
  
      xhr.onerror = () => {
        throw new Error('Network error occurred during the upload');
      };
  
      xhr.send(formData);
    } catch (error : any) {
      console.error('Upload error:', error);
      setError('Upload error: ' + error.message);
      setFilePreview(null);  // Clear the preview if upload fails
      setUploadProgress(null);  // Ensure progress is hidden on error
    } finally {
      setLoading(false);
    }
  };
  
  const triggerFileInputClick = () => {
    fileInputRef.current?.click();
  };

    const handleSubmitRemark = async (messageIndex : any, remark : any) => {
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

    const handleSubmit = async (e?: React.SyntheticEvent) => {
      if (e) e.preventDefault();
    
      console.log('Form submitted');
      setError(null);
    
      // Ensure at least one input is available (text or image)
      if (!query.trim() && !bucketUrl) {
        alert('Please input a question or upload a file');
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
    
      // Add the new user message to the state only if there's text
      if (question) {
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
      }
    
      setQuery('');
    
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
            'Authorization': userEmail,
          },
          body: JSON.stringify({
            question,
            history,
            roomId,
            userEmail,
            imageUrl: bucketUrl  // Always send the image URL if available
          }),
        });
      } catch (error) {
        setError('An error occurred while fetching the data. Please try again.');
        console.error('Error:', error);
      } finally {
        setRequestsInProgress(prev => ({ ...prev, [roomId]: false }));
        setLoading(false);
      }
    };
    
    
    const handleEnter = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (!e.shiftKey && query) {
          e.preventDefault(); // Prevent form submission via enter key
          handleSubmit(); // Call handleSubmit without the event
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

    const handleOpenModal = (type: string, index: number) => {
      setActiveMessageIndex(index);
      setFeedback(prev => ({ ...prev, [index]: { ...prev[index], type } }));
      setFeedbackType(type); // Set the feedback type
      setIsModalOpen(true);
    };
  
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
              <MessageList
                messages={messages}
                loading={loading}
                userHasScrolled={userHasScrolled}
                setUserHasScrolled={setUserHasScrolled}
                imageUrlUserIcon={imageUrlUserIcon}
                botimageIcon={botimageIcon}
                handleOpenModal={handleOpenModal}
              />
              </div>
              <div className={styles.center}>
              <div className={styles.cloudform}>
                <form onSubmit={handleSubmit}>
                <div className={styles.inputArea}>
                <textarea
                  disabled={loading}
                  onKeyDown={handleEnter}
                  ref={textAreaRef}
                  autoFocus={false}
                  rows={1}
                  maxLength={512}
                  id="userInput"
                  name="userInput"
                  placeholder={loading ? 'Waiting for response...' : 'Message SolidCAM ChatBot...'}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={styles.textarea}
                />
              </div>
              {/* <FileUpload
                file={file}
                filePreview={filePreview}
                uploadProgress={uploadProgress}
                loading={loading}
                handleFileChange={handleFileChange}
                removeImage={removeImage}
                triggerFileInputClick={triggerFileInputClick}
                uploadImage={uploadImage}
                setFile={setFile}
                setFilePreview={setFilePreview}
                setUploadProgress={setUploadProgress}
                setError={setError}
                fileInputRef={fileInputRef}
              /> */}
                    <div className={styles.buttonContainer}>
                      <button
                        type="submit"
                        disabled={loading || (!query.trim() && !bucketUrl)}  // Disable the button if both text and image are not provided
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
                    </div>
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
        <FeedbackModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          messageIndex={activeMessageIndex}
          onSubmit={handleSubmitRemark}
          feedbackType={feedbackType}
        />
      </>
    )
  }

// Supporting Interfaces
interface FeedbackState {
  [key: number]: {
    type?: string;
    remark?: string;
  };
}