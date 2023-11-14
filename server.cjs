//server.cjs
const express = require('express');
const { parse } = require('url');
const next = require('next');
const { init } = require('./socketServer.cjs');  // Import the init method
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();

  // Serve static files from the 'public' directory
  server.use(express.static(path.join(__dirname, 'public')));

  // All other requests are forwarded to Next.js
  server.all('*', (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const httpServer = server.listen(process.env.PORT || 3000, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${process.env.PORT || 3000}`);
  });

  // Initialize Socket.io
  init(httpServer);
});
