import { io } from 'socket.io-client';

// Define the server URL based on environment variables
const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
let socket = null; // Variable to store the socket instance

// Function to initialize the socket connection
export const initSocket = () => {
  if (!socket) {
    // Create a new socket connection
    socket = io(serverUrl, {
      transports: ['websocket', 'polling'], // Enable both WebSocket and polling
    });
    console.log('Connecting socket to:', serverUrl);

    // Event when socket is connected
    socket.on("connect", () => {
      //console.log('Socket connected:', socket.id);
    });

    // Event when the server assigns a room to the client
    socket.on("assignedRoom", (roomId) => {
      console.log('Assigned to room:', roomId);
    });

    // Event when a user joins the room
    socket.on("userJoined", (message) => {
      console.log('User joined room:', message);
    });
    
    // Event when a user leaves the room
    socket.on("userLeft", (message) => {
      console.log('User left room:', message);
    });

    // Event when the socket is disconnected
    socket.on("disconnect", (reason) => {
      console.log('Disconnected:', reason);
      // Optionally, try to reconnect or reload chat history here
      // Example: reconnect or load the last chat history
      const lastRoomId = sessionStorage.getItem('lastRoomId');
      if (lastRoomId) {
        console.log('Rejoining room after disconnection:', lastRoomId);
        joinRoom(lastRoomId); // Rejoin the room after disconnect
      }
    });

    // Event when there's a connection error
    socket.on("connect_error", (error) => {
      console.error('Connection Error:', error);
    });

    // Event for any other connection-related errors
    socket.on("connect_timeout", () => {
      console.error('Connection timeout');
    });

    // Handle reconnection attempts
    socket.on("reconnect_attempt", () => {
      console.log('Attempting to reconnect...');
    });

    // Handle reconnection success
    socket.on("reconnect", () => {
      console.log('Reconnected to the server');
    });

    // Handle reconnection failure
    socket.on("reconnect_failed", () => {
      console.error('Failed to reconnect to the server');
    });
  }
};

// Function to disconnect the socket
export const disconnectSocket = () => {
  if (socket) {
    console.log('Disconnecting socket...');
    socket.disconnect();
    socket = null;
  }
};

// Function to get the current socket instance
export const getSocket = () => {
  return socket;
};

// Function to join a room
export const joinRoom = (roomId) => {
  if (socket) {
    console.log(`Joining room: ${roomId}`);
    sessionStorage.setItem('lastRoomId', roomId); // Save the roomId in session storage for reconnection
    socket.emit('joinRoom', roomId);
  }
};

// Function to leave the current room
export const leaveRoom = () => {
  if (socket) {
    console.log('Leaving current room');
    socket.emit('leaveRoom');
  }
};

// Function to send a message to the current room
export const sendMessage = (roomId, message) => {
  if (socket) {
    console.log(`Sending message to room ${roomId}:`, message);
    socket.emit('message', roomId, message);
  }
};
