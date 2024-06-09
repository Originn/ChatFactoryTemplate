import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { DocumentWithMetadata } from '@/interfaces/index_interface';
import {measureFirstTokenTime } from '@/utils/tracking';

const useSocket = (
  serverUrl: string,
  roomId: string | null,
  setRequestsInProgress: (requests: any) => void,
  setMessageState: (state: any) => void,
  setCurrentStage: (stage: number | null) => void,
  setRoomId: (roomId: string) => void
) => {
  const roomIdRef = useRef<string | null>(roomId);
  const firstTokenCalculatedRef = useRef<{ [key: string]: boolean }>({});
  const submitTimeRef = useRef<number | null>(null);
  const [firstTokenTimes, setFirstTokenTimes] = useState<{ [key: string]: number | null }>({});

  useEffect(() => {
    const socket = io(serverUrl, {
      transports: ['websocket'],
    });

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

      socket.on(responseEventName, handleFullResponse);
      return () => socket.off(responseEventName, handleFullResponse);
    };

    if (!roomIdRef.current) {
      socket.emit('requestRoom');
    }

    socket.on('assignedRoom', handleAssignedRoom);
    socket.on('connect_error', (error: any) => console.error('Connection Error:', error));
    socket.on('connect_timeout', (timeout: any) => console.error('Connection Timeout:', timeout));
    socket.on('error', (error: any) => console.error('Error:', error));
    socket.on('disconnect', (reason: any) => console.warn('Disconnected:', reason));

    socket.on('stageUpdate', (newStage: number) => {
      setCurrentStage(newStage);
    });

    socket.on('storeHeader', (header: string) => {
      sessionStorage.setItem('header', header);
    });

    socket.on("removeThumbnails", () => {
      const thumbnailElement = document.querySelector('.image-container-image-thumb');
      if (thumbnailElement) {
        thumbnailElement.remove();
      }
    });

    socket.on("resetStages", () => {
      setCurrentStage(null);
    });

    socket.on("newToken", (token, isLastToken) => {
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

    return () => {
      socket.off('assignedRoom', handleAssignedRoom);
      socket.off('connect_error');
      socket.off('newToken');
      socket.off('stageUpdate');
      socket.off('storeHeader');
      socket.off('resetStages');
      if (roomId) {
        setRequestsInProgress((prev: any) => {
          const updated = { ...prev };
          delete updated[roomId];
          return updated;
        });
      }
      socket.disconnect();
    };
  }, [serverUrl]);

  return { submitTimeRef };
};

export default useSocket;
