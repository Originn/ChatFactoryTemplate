//index.tsx

import { useRef, useState, useEffect } from 'react';
import React from 'react';
import { io } from "socket.io-client";
import Layout from '@/components/layout';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import { Document } from 'utils/GCSLoader';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import rehypeRaw from 'rehype-raw';



let imageUrlUserIcon = '/usericon.png';
let botimageIcon = '/bot-image.png';

if (process.env.NODE_ENV === 'production') {
  imageUrlUserIcon = 'https://solidcam.herokuapp.com/usericon.png';
  botimageIcon = 'https://solidcam.herokuapp.com/bot-image.png';  
}

function addHyperlinksToPageNumbers(content: string, source: string): string {
  // Find all page numbers in the format (number)
  const regex = /\((\d+)\)/g;
  
  return content.replace(regex, (match, pageNumber) => {
      // Construct the hyperlink
      const link = `${source}#page=${pageNumber}`;
      return `<a href="${link}" target="_blank" rel="noopener noreferrer" style="color: blue;">${match}</a>`;
  });
}

export default function Home() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [roomId, setRoomId] = useState<string | null>(null);
  const roomIdRef = useRef<string | null>(null);



  const toggleTheme = () => {
    setTheme(prevTheme => {
        const newTheme = prevTheme === 'light' ? 'dark' : 'light';
        return newTheme;
    });
};


  const answerStartRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
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

  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);
  
  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  // Add this useEffect hook to scroll down whenever messages change
  useEffect(() => {
    if (answerStartRef.current) {
      answerStartRef.current.scrollIntoView();
    }
  }, [messages]);

  useEffect(() => {
    const serverUrl = process.env.NODE_ENV === 'production' ? 'https://solidcam.herokuapp.com/' : 'http://localhost:3000';
    const socket = io(serverUrl);

    socket.on("assignedRoom", (newRoomId) => {
      console.log("I have been assigned to room:", newRoomId);
      setRoomId(newRoomId);
    });
    

    socket.on('connect', () => {
      console.log('Connected to the server');
    });
    
    socket.on('connect_error', (error) => {
      console.log('Connection Error:', error);
    });


    socket.on("newToken", (token) => {
      setMessageState((state) => {
        // Check if the last message is an apiMessage
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage && lastMessage.type === 'apiMessage') {
          // Concatenate token to the last message
          return {
            ...state,
            messages: [
              ...state.messages.slice(0, -1),
              {
                ...lastMessage,
                message: lastMessage.message + token,
              },
            ],
          };
        } else {
          // If the last message is not an apiMessage, create a new one
          return {
            ...state,
            messages: [
              ...state.messages,
              {
                type: 'apiMessage',
                message: token,
              },
            ],
          };
        }
      });
    });

    socket.on(`fullResponse-${roomIdRef.current}`, (response) => {
      setMessageState((prevState) => {
        // Create a copy of the previous messages state
        const updatedMessages = [...prevState.messages];
        const lastMessageIndex = updatedMessages.length - 1;
    
        // Extract the message and documents from the response
        const { answer, sourceDocs } = response;
        const filteredSourceDocs = sourceDocs ? (sourceDocs as Document[]).filter(doc => doc.score !== undefined && doc.score >= 0.6) : [];
        
        // Update the last message with the full answer and append sourceDocs
        if (lastMessageIndex >= 0) {
          const lastMessage = updatedMessages[lastMessageIndex];
          if (lastMessage.type === 'apiMessage') {
            // Create a new last message with the updated details
            const newLastMessage = {
              ...lastMessage,
              message: answer,
              sourceDocs: filteredSourceDocs.length ? filteredSourceDocs : undefined,
            };
            // Replace the last message
            updatedMessages[lastMessageIndex] = newLastMessage;
          }
        }
    
        // Return the updated state
        return {
          ...prevState,
          messages: updatedMessages,
        };
      });
    });    
    
    return () => {
      socket.disconnect();
    };
  }, []);

  //handle form submission
  async function handleSubmit(e: any) {
    e.preventDefault();

    setError(null);

    if (!query) {
      alert('Please input a question');
      return;
    }

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

    setLoading(true);
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

      setLoading(false);

      // Scroll to bottom
      messageListRef.current?.scrollTo(0, messageListRef.current.scrollHeight);
    } catch (error) {
      setLoading(false);
      setError('An error occurred while fetching the data. Please try again.');
      console.log('error', error);
    }
  }

  //prevent empty submissions
  const handleEnter = (e: any) => {
    if (e.key === 'Enter' && query) {
      handleSubmit(e);
    } else if (e.key == 'Enter') {
      e.preventDefault();
    }
  };

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
                                  <h3>Source {docIndex + 1}</h3>
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
    </>
  )};