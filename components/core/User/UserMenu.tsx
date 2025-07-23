// components/core/User/UserMenu.tsx

import React, { useState, useRef, useEffect } from 'react';
import { auth } from '@/utils/firebase';
import { useRouter } from 'next/router';
import useTheme from '@/hooks/useTheme';
import { 
  Button, 
  Menu, 
  MenuItem, 
  Avatar, 
  Divider, 
  Typography, 
  Box 
} from '@mui/material';

interface UserMenuProps {
  className?: string;
}

const UserMenu: React.FC<UserMenuProps> = ({ className }) => {
  const { theme } = useTheme();
  const [userInitials, setUserInitials] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const router = useRouter();

  useEffect(() => {
    // Get user email and initials
    const user = auth.currentUser;
    if (user?.email) {
      setUserEmail(user.email);
    }
    
    if (user?.displayName) {
      // If user has a display name, use the first letter of each part
      const names = user.displayName.split(' ');
      const initials = names.map(name => name.charAt(0).toUpperCase()).join('');
      setUserInitials(initials.substring(0, 2)); // Limit to 2 characters
    } else if (user?.email) {
      const email = user.email;
      // Try to extract two initials from email (username part)
      const username = email.split('@')[0];
      // First try to split by dot or underscore to get name parts
      let parts = username.split(/[._-]/);
      if (parts.length > 1) {
        // Use first letters of first two parts
        setUserInitials((parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase());
      } else {
        // If no separator, use first two letters of username
        setUserInitials(username.substring(0, 2).toUpperCase());
      }
    } else {
      setUserInitials('U');
    }
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSettingsClick = () => {
    handleClose();
    router.push('/settings');
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      handleClose();
      router.push('/login'); // Redirect to login page after logout
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', zIndex: 9999, position: 'relative' }}>
      <Button
        id="user-menu-button"
        aria-controls={open ? 'user-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
        sx={{ 
          minWidth: 'auto', 
          p: 0,
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          zIndex: 9999
        }}
      >
        <Avatar 
          sx={{ 
            width: 32, 
            height: 32, 
            bgcolor: 'primary.main', 
            fontSize: '0.875rem',
            position: 'relative',
            top: '0'
          }}
        >
          {userInitials}
        </Avatar>
      </Button>
      
      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'user-menu-button',
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        sx={{ 
          zIndex: 9999,
          '& .MuiPaper-root': {
            backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
            color: theme === 'dark' ? '#f1f5f9' : '#1e293b',
            border: theme === 'dark' ? '1px solid #444444' : 'none',
          }
        }}
      >
        {userEmail && (
          <Box sx={{ px: 2, py: 1, minWidth: 200 }}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: theme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary'
              }}
            >
              {userEmail}
            </Typography>
            <Divider sx={{ my: 1, borderColor: theme === 'dark' ? '#444444' : '#e2e8f0' }} />
          </Box>
        )}
        
        <MenuItem 
          onClick={handleSettingsClick}
          sx={{ 
            color: theme === 'dark' ? '#f1f5f9' : '#1e293b',
            '&:hover': {
              backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)'
            }
          }}
        >
          Settings & Privacy
        </MenuItem>
        <Divider sx={{ borderColor: theme === 'dark' ? '#444444' : '#e2e8f0' }} />
        <MenuItem 
          onClick={handleLogout}
          sx={{ 
            color: theme === 'dark' ? '#f1f5f9' : '#1e293b',
            '&:hover': {
              backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)'
            }
          }}
        >
          Logout
        </MenuItem>
      </Menu>
    </div>
  );
};

export default UserMenu;