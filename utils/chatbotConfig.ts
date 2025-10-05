// utils/chatbotConfig.ts - Utility for getting chatbot configuration
export interface ChatbotConfig {
  id: string;
  name: string;
  description: string;
  logoUrl: string;
  primaryColor: string;
  bubbleStyle: string;
  requireAuth: boolean;
  accessMode: 'open' | 'managed';
}

export const getChatbotConfig = (): ChatbotConfig => {
  return {
    id: process.env.NEXT_PUBLIC_CHATBOT_ID || '',
    name: process.env.NEXT_PUBLIC_CHATBOT_NAME || 'AI Assistant',
    description: process.env.NEXT_PUBLIC_CHATBOT_DESCRIPTION || 'AI-powered chatbot',
    logoUrl: process.env.NEXT_PUBLIC_CHATBOT_LOGO_URL || '/wizchat-brain-logo.svg',
    primaryColor: process.env.NEXT_PUBLIC_CHATBOT_PRIMARY_COLOR || '#3b82f6',
    bubbleStyle: process.env.NEXT_PUBLIC_CHATBOT_BUBBLE_STYLE || 'rounded',
    requireAuth: process.env.NEXT_PUBLIC_CHATBOT_LOGIN_REQUIRED === 'true',
    accessMode: (process.env.NEXT_PUBLIC_CHATBOT_ACCESS_MODE as 'open' | 'managed') || 'open'
  };
};

export const isAdminManagedChatbot = (): boolean => {
  const config = getChatbotConfig();
  return config.requireAuth && config.accessMode === 'managed';
};

export const isOpenSignupChatbot = (): boolean => {
  const config = getChatbotConfig();
  return config.requireAuth && config.accessMode === 'open';
};

export const isPublicChatbot = (): boolean => {
  const config = getChatbotConfig();
  return !config.requireAuth;
};
