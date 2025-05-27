// pages/index.tsximport React from 'react';
import { ChatbotAuthProvider } from '../contexts/ChatbotAuthContext';
import MainChatApp from '../components/MainChatApp';

const IndexPage: React.FC = () => {
  return (
    <ChatbotAuthProvider>
      <MainChatApp />
    </ChatbotAuthProvider>
  );
};

export default IndexPage;
