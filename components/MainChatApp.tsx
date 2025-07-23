import React from 'react';
import { useChatbotAuth } from '../contexts/ChatbotAuthContext';
import ChatContainer from '../components/core/Chat/ChatContainer';
import { Box, Typography, CircularProgress } from '@mui/material';
import CustomLoginForm from '../auth/CustomLoginForm';

const MainChatApp: React.FC = () => {
  const { 
    user, 
    userProfile, 
    loading, 
    requireAuth, 
    canAccessChat, 
    isAuthRequired 
  } = useChatbotAuth();

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        width="100%"
        sx={{ 
          backgroundColor: 'background.default',
          color: 'text.primary'
        }}
        suppressHydrationWarning
      >
        <CircularProgress suppressHydrationWarning />
        <Typography variant="body2" sx={{ ml: 2 }} suppressHydrationWarning>
          Loading chatbot...
        </Typography>
      </Box>
    );
  }

  // Scenario 1: Auth NOT required - Direct chat access
  if (!isAuthRequired()) {
    console.log('🔓 Auth not required - allowing anonymous chat access');
    return (
      <ChatContainer 
        user={null} // Anonymous user
        userProfile={null}
        isAnonymous={true}
      />
    );
  }

  // Scenario 2: Auth required - Check if user is logged in
  if (isAuthRequired() && !canAccessChat()) {
    console.log('🔐 Auth required but user not logged in - showing login form');
    return (
      <Box 
        sx={{ 
          minHeight: '100vh',
          width: '100%',
          backgroundColor: 'background.default'
        }}
      >
        <CustomLoginForm />
      </Box>
    );
  }

  // Scenario 3: Auth required and user is logged in
  if (isAuthRequired() && canAccessChat() && user) {
    return (
      <ChatContainer 
        user={user}
        userProfile={userProfile}
        isAnonymous={false}
      />
    );
  }

  // Fallback - shouldn't reach here
  return (
    <Box 
      display="flex" 
      justifyContent="center" 
      alignItems="center" 
      minHeight="100vh"
      width="100%"
      sx={{ 
        backgroundColor: 'background.default',
        color: 'text.primary'
      }}
    >
      <Typography variant="h6">Something went wrong</Typography>
    </Box>
  );
};

export default MainChatApp;