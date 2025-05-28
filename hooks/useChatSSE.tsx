// hooks/useChatSSE.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, RequestsInProgressType } from '@/components/core/Chat/types';
import MemoryService from '@/utils/memoryService';
import { auth } from '@/utils/firebase';

interface UseChatSSEParams {
  serverUrl: string;
  initialRoomId: string | null;
  isAnonymous?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  history: [string, string][];
  pendingSourceDocs?: Document[];
}

const useChatSSE = ({ serverUrl, initialRoomId, isAnonymous = false }: UseChatSSEParams) => {
  const [roomId, setRoomId] = useState<string | null>(initialRoomId);
  const [requestsInProgress, setRequestsInProgress] = useState<RequestsInProgressType>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [messageState, setMessageState] = useState<ChatState>({
    messages: [],
    history: [],
  });
  const [currentStage, setCurrentStage] = useState<number | null>(null);
  const [isNewChat, setIsNewChat] = useState(false);
  const submitTimeRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Function to handle SSE messages
  const handleSSEMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (event.type) {
        case 'token':
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
                message: lastMessage.message + data.token,
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
                    message: data.token,
                    sourceDocs: [],
                    isComplete: false,
                    qaId: undefined,
                  },
                ],
              };
            }
          });
          break;
        case 'complete':
          const { answer, sourceDocs, qaId } = data;
      
          if (!answer) {
            console.error('No answer found in the complete response.');
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
                message: answer,
                sourceDocs: sourceDocs || [],
                isComplete: true,
                qaId: qaId,
              };

              return {
                ...prevState,
                messages: updatedMessages,
              };
            } else {
              console.warn('No incomplete apiMessage found to update.');
              return prevState;
            }
          });
          break;

        case 'error':
          setError(data.message || 'An error occurred');
          break;

        case 'done':
          // Stream completed successfully
          break;
      }
    } catch (error) {
      console.error('Error parsing SSE message:', error);
    }
  }, []);
  // Function to stream chat messages via SSE
  const streamChat = useCallback(async (
    question: string,
    history: [string, string][],
    imageUrls: string[],
    userEmail: string,
    endpoint: string = '/api/chat'
  ) => {
    if (!roomId) return;

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // Create an AbortController for cleanup
      const abortController = new AbortController();
      
      // Send POST request to initiate SSE stream
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: userEmail,
        },
        body: JSON.stringify({
          question,
          history,
          roomId,
          imageUrls,
          userEmail,
        }),
        signal: abortController.signal,
      });

      console.log('SSE Response status:', response.status);
      console.log('SSE Response headers:', response.headers.get('content-type'));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('SSE Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Check if response is SSE
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('text/event-stream')) {
        throw new Error('Response is not an SSE stream');
      }

      // Read the SSE stream using the Streams API
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let buffer = '';
      
      // Process the stream
      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            // Keep the last incomplete line in the buffer
            buffer = lines.pop() || '';
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              
              if (line.startsWith('event: ')) {
                const eventType = line.slice(7).trim();
                
                // Look for the data line
                if (i + 1 < lines.length && lines[i + 1].startsWith('data: ')) {
                  const dataLine = lines[i + 1];
                  const data = dataLine.slice(6);
                  
                  try {
                    const messageEvent = new MessageEvent('message', {
                      data: data,
                    });
                    Object.defineProperty(messageEvent, 'type', { value: eventType });
                    handleSSEMessage(messageEvent);
                    
                    i++; // Skip the data line
                  } catch (e) {
                    console.error('Error processing SSE message:', e);
                  }
                }
              }
            }
          }
        } catch (error:any) {
          if (error.name !== 'AbortError') {
            console.error('Stream processing error:', error);
            setError('Connection lost. Please try again.');
          }
        } finally {
          reader.releaseLock();
        }
      };

      // Start processing the stream
      processStream();

      // Store abort controller for cleanup
      eventSourceRef.current = { close: () => abortController.abort() } as any;

    } catch (error) {
      console.error('Error initiating chat stream:', error);
      setError('Failed to start chat. Please try again.');
    }
  }, [roomId, handleSSEMessage]);
  // Function to load the user's latest chat history
  const loadChatHistory = useCallback(async () => {
    if (!roomId) return;

    try {
      const userEmail = auth.currentUser ? auth.currentUser.email : 'testuser@example.com';
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
      } else if (response.status !== 404) {
        throw new Error('Failed to load chat history.');
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      setError('Error loading chat history. Please try again later.');
    }
  }, [roomId]);

  // Function to handle starting a new chat
  const handleNewChat = () => {
    setMessageState({
      messages: [],
      history: [],
    });
  
    MemoryService.clearChatMemory(roomId!);
    const newRoomId = isAnonymous ? `anon-room-${Date.now()}` : `auth-room-${Date.now()}`;
    setRoomId(newRoomId);
    
    // Use appropriate storage based on user type
    if (isAnonymous) {
      sessionStorage.setItem('anonymousRoomId', newRoomId);
    } else {
      localStorage.setItem('roomId', newRoomId);
    }
    
    changeRoom(newRoomId);
    setIsNewChat(true);
  };

  // Function to change the current room
  const changeRoom = (newRoomId: string) => {
    // Close any existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setRoomId(newRoomId);
    
    // Use appropriate storage based on user type
    if (isAnonymous) {
      sessionStorage.setItem('anonymousRoomId', newRoomId);
    } else {
      localStorage.setItem('roomId', newRoomId);
    }
  };

  // Clean up SSE connection on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Load chat history on initialization (skip for anonymous users)
  useEffect(() => {
    if (!isAnonymous && roomId && !isNewChat) {
      loadChatHistory();
    }
  }, [roomId, isNewChat, loadChatHistory, isAnonymous]);

  return {
    roomId,
    setRoomId,
    requestsInProgress,
    setRequestsInProgress,
    loading,
    setLoading,
    error,
    setError,
    messageState,
    setMessageState,
    currentStage,
    setCurrentStage,
    submitTimeRef,
    changeRoom,
    handleNewChat,
    loadChatHistory,
    streamChat,
  };
};

export default useChatSSE;