require('dotenv').config();
const express = require('express');
const { parse } = require('url');
const next = require('next');
const { init } = require('./socketServer.cjs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

console.error('Starting server initialization...');

app.prepare().then(() => {
  console.error('Next.js app prepared.');
  const server = express();

  console.error('Express server created.');

  server.use((req, res, next) => {
    const host = req.header("Host");
    
    if (host === "solidcam.herokuapp.com") {
      console.error('Redirecting from Heroku domain to custom domain');
      return res.redirect(301, `https://www.solidcamchat.com${req.url}`);
    } else if (host === "solidcamchat.com") {
      console.error('Redirecting from apex domain to www subdomain');
      return res.redirect(301, `https://www.solidcamchat.com${req.url}`);
    }
  
    next();
  });

  console.error('Static file serving set up.');
  server.use(express.static(path.join(__dirname, 'public')));

  server.all('*', (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const port = process.env.PORT || 3000;
  const httpServer = server.listen(port, (err) => {
    if (err) {
      console.error('Error starting server:', err);
      throw err;
    }
    console.error(`> Server ready on port ${port}`);
    console.error(`> Environment: ${process.env.NODE_ENV}`);
  });

  console.error('Initializing Socket.io...');
  const io = init(httpServer);
  console.error('Socket.io initialized. Server instance created:', !!io);
}).catch(err => {
  console.error('Error during app preparation:', err);
  process.exit(1);
});