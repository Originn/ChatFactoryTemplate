const { Server } = require("socket.io");

global.io = global.io || null;

module.exports.init = (httpServer) => {
  if (!global.io) {
    global.io = new Server(httpServer, {
      cors: {
        origin: "*",
      },
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
