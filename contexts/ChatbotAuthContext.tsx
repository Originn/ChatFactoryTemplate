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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Load user profile to get original email
        let profile = await ChatbotAuthService.getUserProfile(user.uid);
        
        // If no profile exists (e.g., Google OAuth users who haven't been migrated yet),
        // create a fallback profile from Firebase user data
        if (!profile && user.email) {
          const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;
          const chatbotName = process.env.NEXT_PUBLIC_CHATBOT_NAME || 'AI Assistant';
          
          profile = {
            originalEmail: user.email,
            displayName: user.displayName || user.email,
            chatbotId: chatbotId || 'default',
            chatbotName: chatbotName,
            createdAt: null, // Will be null for fallback profiles
            lastLoginAt: null,
            signInProvider: 'fallback'
          };
          
          // Try to save this fallback profile to Firestore for next time
          if (chatbotId) {
            try {
              const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
              const { db } = await import('../utils/firebase');
              
              const userDocRef = doc(db, 'users', user.uid);
              const profileToSave = {
                ...profile,
                createdAt: serverTimestamp(),
                lastLoginAt: serverTimestamp()
              };
              
              await setDoc(userDocRef, profileToSave);
              profile = profileToSave;
            } catch (saveError) {
              console.error('⚠️ Failed to save fallback profile, continuing with in-memory profile:', saveError);
            }
          }
        }
        
        setUserProfile(profile);
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
