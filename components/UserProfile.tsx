import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Avatar, Chip } from '@mui/material';
import { User } from 'firebase/auth';
import { ChatbotAuthService } from '../utils/chatbotAuth';

interface UserProfileProps {
  user: User;
}

interface UserProfileData {
  originalEmail: string;
  displayName: string;
  chatbotName: string;
  createdAt: any;
  lastLoginAt: any;
}

export const UserProfileDisplay: React.FC<UserProfileProps> = ({ user }) => {
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await ChatbotAuthService.getUserProfile(user.uid);
        if (profile) {
          setProfileData({
            originalEmail: profile.originalEmail,
            displayName: profile.displayName,
            chatbotName: profile.chatbotName,
            createdAt: profile.createdAt,
            lastLoginAt: profile.lastLoginAt
          });
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadProfile();
    }
  }, [user]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ width: 32, height: 32 }}>?</Avatar>
        <Typography variant="body2">Loading...</Typography>
      </Box>
    );
  }

  if (!profileData) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ width: 32, height: 32 }}>?</Avatar>
        <Typography variant="body2">Unknown User</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
        {profileData.originalEmail.charAt(0).toUpperCase()}
      </Avatar>
      <Box>
        <Typography variant="body2" fontWeight="medium">
          {profileData.displayName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {profileData.originalEmail}
        </Typography>
      </Box>
      <Chip 
        label={profileData.chatbotName} 
        size="small" 
        variant="outlined"
        sx={{ fontSize: '0.75rem' }}
      />
    </Box>
  );
};

// Settings page component showing user details
export const UserAccountSettings: React.FC<UserProfileProps> = ({ user }) => {
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const profile = await ChatbotAuthService.getUserProfile(user.uid);
      if (profile) {
        setProfileData(profile);
      }
    };
    loadProfile();
  }, [user]);

  if (!profileData) return null;

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Account Information
      </Typography>
      
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'auto 1fr' }}>
        <Typography variant="body2" color="text.secondary">
          Email:
        </Typography>
        <Typography variant="body2">
          {profileData.originalEmail}
        </Typography>
        
        <Typography variant="body2" color="text.secondary">
          Name:
        </Typography>
        <Typography variant="body2">
          {profileData.displayName}
        </Typography>
        
        <Typography variant="body2" color="text.secondary">
          Chatbot:
        </Typography>
        <Typography variant="body2">
          {profileData.chatbotName}
        </Typography>
        
        <Typography variant="body2" color="text.secondary">
          Account Created:
        </Typography>
        <Typography variant="body2">
          {profileData.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
        </Typography>
      </Box>

      <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
        <Typography variant="caption" color="info.dark">
          ℹ️ This account is specific to the {profileData.chatbotName} chatbot. 
          Each chatbot has its own separate user accounts for privacy and security.
        </Typography>
      </Box>
    </Paper>
  );
};
