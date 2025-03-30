const { Server } = require("socket.io");

global.io = global.io || null;

module.exports.init = (httpServer) => {
  console.error('Initializing Socket.io server...');
  if (!global.io) {
    global.io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
    });

    global.io.on("connection", (socket) => {
      console.error('New Socket.io connection:', socket.id);

      const roomId = socket.id;
      socket.join(roomId);
      console.error(`Socket ${socket.id} joined room ${roomId}`);

      socket.emit("assignedRoom", roomId);
      console.error(`Emitted assignedRoom event to socket ${socket.id} with room ${roomId}`);

      let currentRoom = roomId;

      socket.on("joinRoom", (customRoomId) => {
        console.error(`joinRoom event received for room: ${customRoomId} from socket: ${socket.id}`);
        if (currentRoom) {
          socket.leave(currentRoom);
          console.error(`Socket ${socket.id} left room ${currentRoom}`);
        }
        socket.join(customRoomId);
        currentRoom = customRoomId;
        console.error(`Socket ${socket.id} joined room ${customRoomId}`);
        global.io.to(customRoomId).emit("userJoined", `User joined room ${customRoomId}`);
        console.error(`Emitted userJoined event to room ${customRoomId}`);
      });

      socket.on("leaveRoom", () => {
        console.error(`leaveRoom event received from socket: ${socket.id}`);
        if (currentRoom) {
          socket.leave(currentRoom);
          console.error(`Socket ${socket.id} left room ${currentRoom}`);
          global.io.to(currentRoom).emit("userLeft", `User left room ${currentRoom}`);
          console.error(`Emitted userLeft event to room ${currentRoom}`);
          currentRoom = null;
        }
      });

      socket.on("message", (roomId, message) => {
        console.error(`Message sent to room: ${roomId} by socket: ${socket.id}`);
        if (roomId !== currentRoom) {
          console.error(`Room mismatch: current room is ${currentRoom}, message sent to ${roomId}`);
          return;
        }
        global.io.to(roomId).emit(`fullResponse-${roomId}`, message);
        console.error(`Emitted fullResponse-${roomId} event to room ${roomId}`);
      });
      
      // New handler for stage updates
      socket.on("stageUpdate", (roomId, stage) => {
        console.error(`Stage update to stage ${stage} for room: ${roomId}`);
        if (roomId !== currentRoom) {
          console.error(`Room mismatch for stage update: current room is ${currentRoom}, update sent to ${roomId}`);
          return;
        }
        // Emit both global and room-specific stage update events
        global.io.to(roomId).emit("stageUpdate", stage);
        global.io.to(roomId).emit(`stageUpdate-${roomId}`, stage);
        console.error(`Emitted stageUpdate (${stage}) events to room ${roomId}`);
      });

      socket.on("disconnect", () => {
        console.error(`Socket ${socket.id} disconnected`);
      });
    });
  }
  console.error('Socket.io server initialized');
  return global.io;
};

module.exports.getIO = () => {
  if (!global.io) {
    console.error("Socket.io not initialized!");
    throw new Error("Socket.io not initialized!");
  }
  return global.io;
};