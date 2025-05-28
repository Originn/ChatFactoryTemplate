import { useState, useEffect, useCallback } from 'react';
import { ChatMessage, RequestsInProgressType } from '@/components/core/Chat/types';
import MemoryService from '@/utils/memoryService';
import { auth } from '@/utils/firebase';

interface UseChatParams {
  serverUrl: string;
  initialRoomId: string | null;
}

interface ChatState {
  messages: ChatMessage[];
  history: [string, string][];
  pendingSourceDocs?: Document[];
}

const useChat = ({ serverUrl, initialRoomId }: UseChatParams) => {
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
    setRoomId(newRoomId);
    localStorage.setItem('roomId', newRoomId);
  };

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
  };
};

export default useChat;