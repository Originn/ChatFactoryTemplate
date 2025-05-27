import React from 'react';
import { Box, Chip, Typography, IconButton, Tooltip } from '@mui/material';
import { Person, PersonOff, Info, ExitToApp } from '@mui/icons-material';
import { useChatbotAuth } from '../contexts/ChatbotAuthContext';
import { getChatbotBranding } from '../utils/logo';

interface UserStatusIndicatorProps {
  showDetails?: boolean;
}

export const UserStatusIndicator: React.FC<UserStatusIndicatorProps> = ({ 
  showDetails = false 
}) => {
  const { user, userProfile, isAuthRequired, signOut, isAnonymous } = useChatbotAuth();
  const chatbotBranding = getChatbotBranding();

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      await signOut();
    }
  };

  // If auth is required but no user is logged in, show login required status
  if (isAuthRequired() && !user) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          icon={<PersonOff />}
          label="Login Required"
          variant="outlined"
          size="small"
          color="warning"
          sx={{ borderColor: 'warning.main', color: 'warning.main' }}
        />
        {showDetails && (
          <Tooltip title="This chatbot requires authentication to use">
            <Info sx={{ fontSize: 16, color: 'warning.main' }} />
          </Tooltip>
        )}
      </Box>
    );
  }

  // Anonymous user display (auth not required)
  if (isAnonymous()) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          icon={<PersonOff />}
          label="Anonymous User"
          variant="outlined"
          size="small"
          sx={{ color: 'text.secondary', borderColor: 'grey.400' }}
        />
        {showDetails && (
          <Tooltip title="You're chatting anonymously. No account required!">
            <Info sx={{ fontSize: 16, color: 'text.secondary' }} />
          </Tooltip>
        )}
      </Box>
    );
  }

  // Authenticated user display
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Chip
        icon={<Person />}
        label={userProfile?.originalEmail || user?.email || 'User'}
        variant="filled"
        size="small"
        color="primary"
      />
      
      {showDetails && (
        <>
          <Typography variant="caption" color="text.secondary">
            • {chatbotBranding.name}
          </Typography>
          
          <Tooltip title="Sign out">
            <IconButton size="small" onClick={handleSignOut}>
              <ExitToApp sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  );
};

// Header component for the chat interface
export const ChatHeader: React.FC = () => {
  const { requireAuth } = useChatbotAuth();
  const chatbotBranding = getChatbotBranding();
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {chatbotBranding.logoUrl && (
          <img
            src={chatbotBranding.logoUrl}
            alt={`${chatbotBranding.name} Logo`}
            style={{ width: 32, height: 32, objectFit: 'contain' }}
            onError={(e) => {
              e.currentTarget.src = '/bot-icon-generic.svg';
            }}
          />
        )}
        <Typography variant="h6" component="h1">
          {chatbotBranding.name}
        </Typography>
      </Box>

      <UserStatusIndicator showDetails={true} />
    </Box>
  );
};
