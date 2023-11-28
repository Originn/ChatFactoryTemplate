// socketManager.js
import { io } from 'socket.io-client';

const serverUrl = process.env.NODE_ENV === 'production' ? 'https://your-production-url.com' : 'http://localhost:3000';
let socket = null;

export const initSocket = () => {
  if (!socket) {
    socket = io(serverUrl);
    console.log('Connecting socket...');
    socket.on("assignedRoom", (roomId) => {
        console.log('Assigned to room:', roomId);
        // Handle room assignment (e.g., store roomId in state)
    });

    socket.on("userJoined", (message) => {
        console.log('User joined room:', message);
        // Handle new user joining (e.g., update UI)
    });
    
    socket.on("userLeft", (message) => {
        console.log('User left room:', message);
        // Handle user leaving (e.g., update UI)
    });

    socket.on("userLeft", (message) => {
        console.log('User left room:', message);
        // Handle user leaving (e.g., update UI)
    });
    
    // Assuming roomId is known and stored in state or similar
    const roomId = "yourRoomId"; // Replace with actual roomId
    socket.on(`fullResponse-${roomId}`, (message) => {
        console.log(`Message for room ${roomId}:`, message);
        // Handle incoming message for the room
    });

    socket.on("connect", () => {
    console.log('Socket connected:', socket.id);
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
