import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChatMessage, RequestsInProgressType } from '@/components/core/Chat/types';
import MemoryService from '@/utils/memoryService';
import { auth } from '@/utils/firebase';

interface UseChatParams {
  serverUrl: string;
  initialRoomId: string | null;
  isAnonymous?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  history: [string, string][];
  pendingSourceDocs?: Document[];
}

const useChat = ({ serverUrl, initialRoomId, isAnonymous = false }: UseChatParams) => {
  const [socket, setSocket] = useState<Socket | null>(null);
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
  const submitTimeRef = { current: 0 }; // Replace useRef with a simple object for compatibility

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(serverUrl, {
      secure: true,
      transports: ['websocket'],
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }, [serverUrl]);

  // Emit 'joinRoom' whenever socket or roomId changes
  useEffect(() => {
    if (socket && roomId) {
      socket.emit('joinRoom', roomId);
    }
  }, [socket, roomId]);

  // Set up socket listeners for token stream and full response
  useEffect(() => {
    if (socket && roomId) {
      const handleNewToken = (token: string) => {
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
              message: lastMessage.message + token,
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
                  message: token,
                  sourceDocs: [],
                  isComplete: false,
                  qaId: undefined,
                },
              ],
            };
          }
        });
      };      const handleFullResponse = (message: { answer: string; sourceDocs: any[]; qaId: string; }) => {
        const { answer, sourceDocs, qaId } = message;
      
        if (!answer) {
          console.error('No answer found in the full response message.');
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
              message: answer, // Replace with the full answer
              sourceDocs: sourceDocs || [],
              isComplete: true,
              qaId: qaId, // Set the qaId here
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
      };

      socket.on(`tokenStream-${roomId}`, handleNewToken);
      socket.on(`fullResponse-${roomId}`, handleFullResponse);

      return () => {
        socket.off(`tokenStream-${roomId}`, handleNewToken);
        socket.off(`fullResponse-${roomId}`, handleFullResponse);
      };
    }
  }, [socket, roomId]);

  // Handle socket reconnection
  useEffect(() => {
    if (socket) {
      socket.on('disconnect', (reason) => {
        // console.warn('Socket disconnected:', reason);
      });

      socket.io.on('reconnect_attempt', (attemptNumber) => {
        // console.log('Attempting to reconnect:', attemptNumber);
      });

      socket.io.on('reconnect', (attemptNumber) => {
        // console.log('Socket reconnected after', attemptNumber, 'attempts');
        if (roomId) {
          socket.emit('joinRoom', roomId);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('disconnect');
        socket.io.off('reconnect_attempt');
        socket.io.off('reconnect');
      }
    };
  }, [socket, roomId]);

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
  }, [roomId]); // Include roomId in dependencies  // Function to handle starting a new chat
  const handleNewChat = () => {
    setMessageState({
      messages: [],
      history: [],
    });
  
    MemoryService.clearChatMemory(roomId!);
    const newRoomId = `room-${Date.now()}`;
    setRoomId(newRoomId);
    localStorage.setItem('roomId', newRoomId);
    
    // Use only one method to change rooms
    changeRoom(newRoomId);
  
    setIsNewChat(true);
  };

  // Function to change the current room
  const changeRoom = (newRoomId: string) => {
    if (socket) {
      socket.emit('leaveRoom', roomId);
      socket.emit('joinRoom', newRoomId);
    }
    
    setRoomId(newRoomId);
    localStorage.setItem('roomId', newRoomId);
  };

  // Load chat history on initialization (skip for anonymous users)
  useEffect(() => {
    if (!isAnonymous && roomId && !isNewChat) {
      loadChatHistory();
    }
  }, [roomId, isNewChat, loadChatHistory, isAnonymous]);

  return {
    socket,
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
  };
};

export default useChat;