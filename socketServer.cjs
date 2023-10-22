//sockerServer.cjs
const { Server } = require("socket.io");

global.io = global.io || null;

module.exports.init = (httpServer) => {
  if (!global.io) {
    global.io = new Server(httpServer, {
      cors: {
        origin: "*",
      },
    });

    global.io.on("connection", (socket) => {
      console.log('New connection:', socket.id);

      // Use the socket's ID as the room ID
      const roomId = socket.id;
      socket.join(roomId);

      // Optionally: Notify the user that they have joined their unique room
      socket.emit("assignedRoom", roomId);

      // For handling the 'joinRoom' event, in case you still need it for other purposes
      let currentRoom = roomId;

      socket.on("joinRoom", (customRoomId) => {
        console.log(`joinRoom event received for room: ${customRoomId}`);
        if (currentRoom) {
          socket.leave(currentRoom);
        }
        socket.join(customRoomId);
        currentRoom = customRoomId;
        // Optionally: Notify the room that a new user has joined
        global.io.to(customRoomId).emit("userJoined", `User joined room ${customRoomId}`);
      });

      socket.on("leaveRoom", () => {
        if (currentRoom) {
          socket.leave(currentRoom);
          // Optionally: Notify the room that a user has left
          global.io.to(currentRoom).emit("userLeft", `User left room ${currentRoom}`);
          currentRoom = null;
        }
      });

      socket.on("message", (roomId, message) => {
        console.log(`Message sent to room: ${roomId} by socket: ${socket.id}`);
        if (roomId !== currentRoom) {
          return;
        }
        global.io.to(roomId).emit("message", message);
      });
      
    });
  }
  return global.io;
};

module.exports.getIO = () => {
  if (!global.io) {
    throw new Error("Socket.io not initialized!");
  }
  return global.io;
};
