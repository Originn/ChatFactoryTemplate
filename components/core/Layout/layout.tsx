import Image from 'next/image';
import { auth } from '@/utils/firebase';
import { ChatHistoryItem } from '@/components/core/Chat/types';
import ChatHistory from '@/components/core/Chat/ChatHistory';
import UserMenu from '@/components/core/User';
import { FC } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Tooltip,
  Box,
  Container,
} from '@mui/material';

interface LayoutProps {
  children?: React.ReactNode;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onHistoryItemClick: (conversation: ChatHistoryItem) => void;
  handleNewChat: () => void;
}

const PRODUCTION_ENV = 'production';
const PRODUCTION_URL = 'https://solidcam.herokuapp.com/';

// Define icon paths with environment awareness
const getIconPaths = () => {
  const basePath = process.env.NODE_ENV === PRODUCTION_ENV ? PRODUCTION_URL : '/';
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
  const userEmail = auth.currentUser ? auth.currentUser.email : '';
  const { moonIcon } = getIconPaths();

  const iconButtonSx = { width: 40, height: 40, mr: 1 };

  return (
    <Box display="flex" flexDirection="column" minHeight="100vh">
      <AppBar position="sticky" color="default">
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center">
            {userEmail && (
              <Tooltip title="View chat history">
                <IconButton sx={iconButtonSx} aria-label="View chat history">
                  <ChatHistory
                    userEmail={userEmail}
                    className="relative z-50"
                    onHistoryItemClick={onHistoryItemClick}
                  />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="Start a new chat">
              <IconButton onClick={handleNewChat} sx={{ ...iconButtonSx, bgcolor: 'primary.main', color: 'white' }} aria-label="Start a new chat">
                <Image src="/new-chat.png" alt="Start New Chat" width={24} height={24} />
              </IconButton>
            </Tooltip>

            <Tooltip title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              <IconButton onClick={toggleTheme} sx={iconButtonSx} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                {theme === 'dark' ? (
                  <Image src="icons8-sun.svg" alt="Sun Icon" width={24} height={24} />
                ) : (
                  <Image src={moonIcon} alt="Moon Icon" width={24} height={24} />
                )}
              </IconButton>
            </Tooltip>
          </Box>
          {userEmail && <UserMenu />}
        </Toolbar>
      </AppBar>
      <Box flex={1} display="flex" flexDirection="column" overflow="hidden">
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {children}
        </main>
      </Box>
    </Box>
  );
};

export default Layout;