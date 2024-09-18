import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { DocumentWithMetadata } from '@/interfaces/index_interface';
import { measureFirstTokenTime } from '@/utils/tracking';
import MemoryService from '@/utils/memoryService'; // Make sure MemoryService is imported if you're using it for memory
import { auth } from '@/utils/firebase';


const useSocket = (
  serverUrl: string,
  initialRoomId: string | null,
  setRequestsInProgress: (requests: any) => void,
  setMessageState: (state: any) => void,
  setCurrentStage: (stage: number | null) => void,
  setRoomId: (roomId: string) => void
) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const roomIdRef = useRef<string | null>(initialRoomId);
  const firstTokenCalculatedRef = useRef<{ [key: string]: boolean }>({});
  const submitTimeRef = useRef<number | null>(null);
  const [firstTokenTimes, setFirstTokenTimes] = useState<{ [key: string]: number | null }>({});
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Function to change rooms
  const changeRoom = useCallback((newRoomId: string) => {
    if (socket) {
      // Leave the current room
      if (roomIdRef.current) {
        socket.emit('leave', roomIdRef.current);
      }
      // Join the new room
      socket.emit('join', newRoomId);
      roomIdRef.current = newRoomId;
      setRoomId(newRoomId);
      setRequestsInProgress((prev: any) => ({ ...prev, [newRoomId]: false }));
    }
  }, [socket, setRoomId, setRequestsInProgress]);

  // Function to load chat history
  const loadChatHistory = useCallback(async (roomId: string | null) => {
    if (!roomId) return;
    console.log('Loading chat history for roomId before getItem:', roomId);
    roomId = localStorage.getItem('roomId');
    console.log('Loading chat history for roomId:', roomId);
    const userEmail = auth.currentUser ? auth.currentUser.email : null;

    console.log('Set userEmail in local storage:', userEmail);


    try {
      const response = await fetch(`/api/latest-chat-history?userEmail=${userEmail}&roomId=${roomId}`);
      if (response.ok) {
        const historyData = await response.json();
        if (historyData && historyData.conversation_json) {
          const conversation = historyData.conversation_json;
  
          // Parse the conversation and update the message state
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
  
          // Load the full conversation into MemoryService
          if (roomId !== null) {
            MemoryService.loadFullConversationHistory(roomId, conversation);
          }        }
      } else {
        console.error('Failed to load chat history');
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  }, [setMessageState]);

  useEffect(() => {
    const newSocket: Socket = io(serverUrl, {
      transports: ['websocket'],
    });

    setSocket(newSocket);

    // Event handler for 'assignedRoom'
    const handleAssignedRoom = (assignedRoomId: string) => {
      setRequestsInProgress((prev: any) => ({ ...prev, [assignedRoomId]: false }));
      if (!roomIdRef.current) {
        roomIdRef.current = assignedRoomId;
        setRoomId(assignedRoomId); // Update the state in the parent component
      }

      const responseEventName = `fullResponse-${assignedRoomId}`;
      const handleFullResponse = (response: any) => {
        setMessageState((state: any) => {
          const { sourceDocs, qaId } = response;

          // Deduplicate source documents based on URL timestamps
          const deduplicatedDocs = sourceDocs.reduce((acc: DocumentWithMetadata[], doc: DocumentWithMetadata) => {
            const sourceURL = doc.metadata.source;
            if (sourceURL) {
              const timestamp = sourceURL.match(/t=(\d+)s$/)?.[1];
              if (timestamp && !acc.some((d: DocumentWithMetadata) => d.metadata.source.includes(`t=${timestamp}s`))) {
                acc.push(doc);
              } else if (!timestamp) {
                acc.push(doc);
              }
            } else {
              acc.push(doc);
            }
            return acc;
          }, []);

          // Update the last message with source documents
          const updatedMessages = state.messages.map((message: any, index: number, arr: any[]) => {
            if (index === arr.length - 1 && message.type === 'apiMessage') {
              return { ...message, sourceDocs: deduplicatedDocs, qaId, isComplete: true };
            }
            return message;
          });

          return { ...state, messages: updatedMessages };
        });

        firstTokenCalculatedRef.current[assignedRoomId] = false;
      };

      newSocket.on(responseEventName, handleFullResponse);
      return () => newSocket.off(responseEventName, handleFullResponse);
    };

    if (!roomIdRef.current) {
      newSocket.emit('requestRoom');
    }

    newSocket.on('assignedRoom', handleAssignedRoom);
    newSocket.on('connect_error', (error: any) => console.error('Connection Error:', error));
    newSocket.on('connect_timeout', (timeout: any) => console.error('Connection Timeout:', timeout));
    newSocket.on('error', (error: any) => console.error('Error:', error));
    newSocket.on('disconnect', (reason: any) => {
      console.warn('Disconnected:', reason);
      if (roomIdRef.current) {
        loadChatHistory(roomIdRef.current); // Reload chat history on disconnect
      }
    });

    newSocket.on('stageUpdate', (newStage: number) => {
      setCurrentStage(newStage);
    });

    newSocket.on('storeHeader', (header: string) => {
      sessionStorage.setItem('header', header);
    });

    newSocket.on("removeThumbnails", () => {
      const thumbnailElement = document.querySelector('.image-container-image-thumb');
      if (thumbnailElement) {
        thumbnailElement.remove();
      }
    });

    newSocket.on("resetStages", () => {
      setCurrentStage(null);
    });

    newSocket.on("newToken", (token, isLastToken) => {
      setMessageState((state: any) => {
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
      if (!firstTokenTimes[currentRoomId] && !firstTokenCalculatedRef.current[currentRoomId]) {
        const currentTime = performance.now();
        setFirstTokenTimes((prevTimes: any) => ({ ...prevTimes, [currentRoomId]: currentTime }));

        if (submitTimeRef.current) {
          const timeDifference = currentTime - submitTimeRef.current;
          measureFirstTokenTime(timeDifference);  // Assuming this is a function to measure the time
        }

        firstTokenCalculatedRef.current[currentRoomId] = true;
      }
    });

    newSocket.on('uploadStatus', (status: string) => {
      setUploadStatus(status);
    });

    return () => {
      newSocket.off('assignedRoom', handleAssignedRoom);
      newSocket.off('connect_error');
      newSocket.off('newToken');
      newSocket.off('stageUpdate');
      newSocket.off('storeHeader');
      newSocket.off('resetStages');
      newSocket.off('uploadStatus');
      if (roomIdRef.current) {
        setRequestsInProgress((prev: any) => {
          const updated = { ...prev };
          delete updated[roomIdRef.current!];
          return updated;
        });
      }
      newSocket.disconnect();
    };
  }, [serverUrl, setRequestsInProgress, setMessageState, setCurrentStage, setRoomId, loadChatHistory]);

  return { submitTimeRef, uploadStatus, changeRoom };
};

export default useSocket;
