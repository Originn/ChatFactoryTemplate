// hooks/useChatSSE.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, RequestsInProgressType } from '@/components/core/Chat/types';
import MemoryService from '@/utils/memoryService';
import { auth } from '@/utils/firebase';

interface UseChatSSEParams {
  serverUrl: string;
  initialRoomId: string | null;
}

interface ChatState {
  messages: ChatMessage[];
  history: [string, string][];
  pendingSourceDocs?: Document[];
}

const useChatSSE = ({ serverUrl, initialRoomId }: UseChatSSEParams) => {
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
    endpoint: string = '/api/chat-stream'
  ) => {
    if (!roomId) return;

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
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
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // The response itself is the SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let buffer = '';
      
      // Read the SSE stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Process complete lines, keep incomplete line in buffer
        buffer = lines.pop() || '';
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            
            // Look for the corresponding data line
            if (i + 1 < lines.length && lines[i + 1].startsWith('data: ')) {
              const dataLine = lines[i + 1];
              const data = dataLine.slice(6);
              
              try {
                const messageEvent = new MessageEvent('message', {
                  data: data,
                });
                Object.defineProperty(messageEvent, 'type', { value: eventType });
                handleSSEMessage(messageEvent);
                
                // Skip the data line since we've processed it
                i++;
              } catch (e) {
                console.error('Error processing SSE message:', e);
              }
            }
          }
        }
      }

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
    const newRoomId = `room-${Date.now()}`;
    setRoomId(newRoomId);
    localStorage.setItem('roomId', newRoomId);
    
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
    localStorage.setItem('roomId', newRoomId);
  };

  // Clean up SSE connection on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Load chat history on initialization
  useEffect(() => {
    if (roomId && !isNewChat) {
      loadChatHistory();
    }
  }, [roomId, isNewChat, loadChatHistory]);

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