const fs = require('fs');
const path = require('path');

const base64Credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
if (!base64Credentials) {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS_BASE64 environment variable is not set.');
}

const decodedCredentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
const credentialsPath = path.join(__dirname, '..', 'my-drive-390208-f428ca482a32.json');

fs.writeFileSync(credentialsPath, decodedCredentials);

process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
