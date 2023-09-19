//server.cjs

const { createServer } = require("http");
const { parse } = require("url");
const { init } = require("./socketServer.cjs");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Initialize socket.io
  const io = init(server);

  io.on("connection", (socket) => {
    console.log("Client connected!");

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
