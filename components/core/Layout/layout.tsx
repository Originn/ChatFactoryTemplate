import Image from 'next/image';
import { auth } from '@/utils/firebase';
import { ChatHistoryItem } from '@/components/core/Chat/types';
import ChatHistory from '@/components/core/Chat/ChatHistory';
import UserMenu from '@/components/core/User';
import { getTemplateConfig } from '@/config/template';
import { FC } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Tooltip,
  Box,
  Container,
  Typography,
} from '@mui/material';

interface LayoutProps {
  children?: React.ReactNode;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onHistoryItemClick: (conversation: ChatHistoryItem) => void;
  handleNewChat: () => void;
}

const PRODUCTION_ENV = 'production';

// Define icon paths with environment awareness
const getIconPaths = () => {
  const basePath = '/';
  return {
    moonIcon: `${basePath}icons8-moon-50.png`,
  };
};

const Layout: FC<LayoutProps> = ({ 
  children, 
  theme, 
  toggleTheme, 
  onHistoryItemClick, 
  handleNewChat
}) => {
  const config = getTemplateConfig();
  const userEmail = auth.currentUser ? auth.currentUser.email : '';
  const { moonIcon } = getIconPaths();

  const iconButtonSx = { 
    width: { xs: 32, sm: 40 }, 
    height: { xs: 32, sm: 40 }, 
    mr: { xs: 0.5, sm: 1 } 
  };

  return (
    <Box 
      display="flex" 
      flexDirection="column" 
      minHeight="100vh"
      sx={{ 
        backgroundColor: theme === 'dark' ? '#000000' : 'inherit'
      }}
    >
      <AppBar 
        position="sticky" 
        color="default" 
        sx={{ 
          height: '64px',
          backgroundColor: theme === 'dark' ? '#000000' : 'inherit',
          borderBottom: theme === 'dark' ? '1px solid #444444' : 'none'
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', alignItems: 'center', height: '64px', minHeight: '64px' }}>
          {/* Left side controls */}
          <Box display="flex" alignItems="center">
            {userEmail && (
              <ChatHistory
                userEmail={userEmail}
                className="relative z-50"
                onHistoryItemClick={onHistoryItemClick}
              />
            )}

            <Tooltip title="Start a new chat">
              <IconButton onClick={handleNewChat} sx={{ ...iconButtonSx, bgcolor: 'primary.main', color: 'white' }} aria-label="Start a new chat">
                <Image 
                  src="/new-chat.png" 
                  alt="Start New Chat" 
                  width={24} 
                  height={24} 
                  style={{ 
                    width: 'clamp(18px, 4vw, 24px)', 
                    height: 'clamp(18px, 4vw, 24px)' 
                  }} 
                />
              </IconButton>
            </Tooltip>

            <Tooltip title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              <IconButton 
                onClick={toggleTheme} 
                sx={{
                  ...iconButtonSx,
                  color: theme === 'dark' ? 'white' : 'inherit',
                  '&:hover': {
                    backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)'
                  }
                }} 
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? (
                  <Image 
                    src="icons8-sun.svg" 
                    alt="Sun Icon" 
                    width={24} 
                    height={24} 
                    style={{ 
                      filter: 'invert(1)',
                      width: 'clamp(18px, 4vw, 24px)', 
                      height: 'clamp(18px, 4vw, 24px)' 
                    }} 
                  />
                ) : (
                  <Image 
                    src={moonIcon} 
                    alt="Moon Icon" 
                    width={24} 
                    height={24} 
                    style={{ 
                      width: 'clamp(18px, 4vw, 24px)', 
                      height: 'clamp(18px, 4vw, 24px)' 
                    }} 
                  />
                )}
              </IconButton>
            </Tooltip>
          </Box>

          {/* Center title */}
          <Box sx={{ 
            position: 'absolute', 
            left: '50%', 
            transform: 'translateX(-50%)',
            maxWidth: { xs: '150px', sm: '300px', md: 'none' },
            overflow: 'hidden'
          }}>
            <Typography 
              variant="h5" 
              fontWeight="bold" 
              color="primary"
              sx={{
                fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.5rem' },
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {config.productName} ChatBot
            </Typography>
          </Box>

          {/* Right side controls */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {userEmail && <UserMenu />}
          </Box>
        </Toolbar>
      </AppBar>
      <Box 
        flex={1} 
        display="flex" 
        flexDirection="column"
        sx={{ 
          backgroundColor: theme === 'dark' ? '#000000' : 'inherit',
          minHeight: '100vh'
        }}
      >
        <main style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: theme === 'dark' ? '#000000' : 'inherit'
        }}>
          {children}
        </main>
      </Box>
    </Box>
  );
};

export default Layout;