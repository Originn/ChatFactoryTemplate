import { io } from 'socket.io-client';

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
let socket = null;

export const initSocket = () => {
  if (!socket) {
    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
    });
    console.log('Connecting socket to:', serverUrl);

    socket.on("connect", () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on("assignedRoom", (roomId) => {
      console.log('Assigned to room:', roomId);
    });

    socket.on("userJoined", (message) => {
      console.log('User joined room:', message);
    });
    
    socket.on("userLeft", (message) => {
      console.log('User left room:', message);
    });
    
    socket.on("disconnect", (reason) => {
      console.log('Disconnected:', reason);
    });
      
    socket.on("connect_error", (error) => {
      console.error('Connection Error:', error);
    });
  }
};

export const disconnectSocket = () => {
  if (socket) {
    console.log('Disconnecting socket...');
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => {
  return socket;
};

export const joinRoom = (roomId) => {
  if (socket) {
    socket.emit('joinRoom', roomId);
  }
};

export const leaveRoom = () => {
  if (socket) {
    socket.emit('leaveRoom');
  }
};

export const sendMessage = (roomId, message) => {
  if (socket) {
    socket.emit('message', roomId, message);
  }
};