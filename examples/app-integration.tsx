// pages/_app.tsx - How to integrate the authentication context

import { ChatbotAuthProvider } from '../contexts/ChatbotAuthContext';
import { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ChatbotAuthProvider>
      <Component {...pageProps} />
    </ChatbotAuthProvider>
  );
}

// In any component, you can now access:
// const { user, userProfile, requireAuth, canAccessChat } = useChatbotAuth();

// userProfile.originalEmail = "john@email.com" (what user sees)
// user.email = "john@email.com_chatbot-A@chatbot.local" (internal Firebase)
