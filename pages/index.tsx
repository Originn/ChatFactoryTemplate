// pages/index.tsximport React from 'react';
import { ChatbotAuthProvider } from '../contexts/ChatbotAuthContext';
import MainChatApp from '../components/MainChatApp';
import { Box } from '@mui/material';

const IndexPage: React.FC = () => {
  return (
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
  );
};

export default IndexPage;
