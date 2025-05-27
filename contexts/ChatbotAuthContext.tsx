import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ChatbotAuthService } from '../utils/chatbotAuth';

interface ChatbotAuthContextType {
  user: User | null;
  userProfile: any | null;
  loading: boolean;
  requireAuth: boolean;
  isAuthRequired: () => boolean;
  canAccessChat: () => boolean;
  isAnonymous: () => boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
}

const ChatbotAuthContext = createContext<ChatbotAuthContextType | undefined>(undefined);

export const ChatbotAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Get the auth requirement from environment variable
  const requireAuth = process.env.NEXT_PUBLIC_CHATBOT_LOGIN_REQUIRED === 'true';

  useEffect(() => {
    console.log('🔐 Chatbot Auth Settings:', {
      requireAuth,
      chatbotId: process.env.NEXT_PUBLIC_CHATBOT_ID,
      chatbotName: process.env.NEXT_PUBLIC_CHATBOT_NAME
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('👤 Auth State Changed:', user ? `Logged in as ${user.uid}` : 'Not logged in');
      setUser(user);
      
      if (user) {
        // Load user profile to get original email
        const profile = await ChatbotAuthService.getUserProfile(user.uid);
        setUserProfile(profile);
        console.log('👤 User Profile:', profile);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [requireAuth]);

  const signUp = async (email: string, password: string, displayName?: string) => {
    return await ChatbotAuthService.registerUser({ email, password, displayName });
  };

  const signIn = async (email: string, password: string) => {
    return await ChatbotAuthService.loginUser(email, password);
  };

  const signOut = async () => {
    await auth.signOut();
  };

  const isAuthRequired = (): boolean => {
    return requireAuth;
  };

  const canAccessChat = (): boolean => {
    if (!requireAuth) {
      return true; // Auth not required, anyone can access
    }
    
    return !!user; // Auth required, user must be logged in
  };

  const isAnonymous = (): boolean => {
    // User is anonymous if:
    // 1. Auth is not required (anonymous access allowed), OR
    // 2. Auth is required but user is not logged in
    return !requireAuth || !user;
  };

  const value: ChatbotAuthContextType = {
    user,
    userProfile,
    loading,
    requireAuth,
    isAuthRequired,
    canAccessChat,
    isAnonymous,
    signUp,
    signIn,
    signOut
  };

  return (
    <ChatbotAuthContext.Provider value={value}>
      {children}
    </ChatbotAuthContext.Provider>
  );
};

export const useChatbotAuth = (): ChatbotAuthContextType => {
  const context = useContext(ChatbotAuthContext);
  if (context === undefined) {
    throw new Error('useChatbotAuth must be used within a ChatbotAuthProvider');
  }
  return context;
};
