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

      let currentRoom = null;

      // Handle room assignment or joining
      socket.on("joinRoom", (roomId) => {
        console.log(`Socket ${socket.id} joining room: ${roomId}`);
        if (currentRoom) {
          socket.leave(currentRoom);
        }
        socket.join(roomId);
        currentRoom = roomId;
        socket.emit("roomJoined", roomId);
      });

      // Handle room leaving
      socket.on("leaveRoom", () => {
        if (currentRoom) {
          console.log(`Socket ${socket.id} leaving room: ${currentRoom}`);
          socket.leave(currentRoom);
          currentRoom = null;
        }
      });

      // Handle messages
      socket.on('message', async (roomId, message) => {
        console.log(`Message sent to room: ${roomId} by socket: ${socket.id}`);
        global.io.to(roomId).emit(`fullResponse-${roomId}`, message);
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`Socket ${socket.id} disconnected`);
        if (currentRoom) {
          socket.leave(currentRoom);
        }
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