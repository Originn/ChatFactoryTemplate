//scripts\decode-google-credentials.js
const fs = require('fs');
const path = require('path');

const base64Credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
if (!base64Credentials) {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS_BASE64 environment variable is not set.');
}

const decodedCredentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
const credentialsPath = path.join(__dirname, '..', 'solidcamchat-d2e223321c7b.json');

fs.writeFileSync(credentialsPath, decodedCredentials);

process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
