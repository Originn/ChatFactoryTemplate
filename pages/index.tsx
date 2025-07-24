// pages/index.tsx
import React from 'react';
import Head from 'next/head';
import { ChatbotAuthProvider } from '../contexts/ChatbotAuthContext';
import MainChatApp from '../components/MainChatApp';
import { Box } from '@mui/material';
import { getAppTitle, getAppDescription } from '../utils/favicon';

const IndexPage: React.FC = () => {
  return (
    <>
      <Head>
        <title>{getAppTitle()}</title>
        <meta name="description" content={getAppDescription()} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Box 
        sx={{ 
          minHeight: '100vh',
          height: '100%',
          width: '100%',
          backgroundColor: 'background.default',
        }}
      >
        <ChatbotAuthProvider>
          <MainChatApp />
        </ChatbotAuthProvider>
      </Box>
    </>
  );
};

export default IndexPage;
