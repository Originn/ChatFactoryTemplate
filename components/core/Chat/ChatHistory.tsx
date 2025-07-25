import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import {
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Button,
  CircularProgress,
  Typography,
  Box,
} from '@mui/material';
import { ChatHistoryItem } from './types';

interface ChatHistoryProps {
  userEmail: string;
  className?: string;
  onHistoryItemClick: (conversation: ChatHistoryItem) => void;
}

type TimeRange = 'today' | 'yesterday' | '7days' | '30days';

const ChatHistory: React.FC<ChatHistoryProps> = ({
  userEmail,
  className,
  onHistoryItemClick,
}) => {
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [category, setCategory] = useState<TimeRange>('today');
  const [showMenu, setShowMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchChatHistory = async (range: string) => {
    setError(null);
    setIsLoading(true);
    
    try {
      const response = await fetch(
        `/api/chat-history?userEmail=${encodeURIComponent(userEmail)}&range=${range}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat history');
      }
      
      const fetchedHistory: ChatHistoryItem[] = await response.json();
      setHistory(fetchedHistory);
    } catch (err) {
      console.error('Error fetching chat history:', err);
      setError('Failed to fetch chat history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch history when menu is opened
  useEffect(() => {
    if (showMenu) {
      const timer = setTimeout(() => {
        fetchChatHistory(category);
      }, 300); // 300ms delay to prevent excessive API calls
      return () => clearTimeout(timer);
    }
  }, [showMenu, category]);


  const handleCategoryChange = (newCategory: TimeRange) => {
    setCategory(newCategory);
    fetchChatHistory(newCategory);
  };

  const handleHistoryItemClick = (chat: ChatHistoryItem) => {
    onHistoryItemClick(chat);
    setShowMenu(false);
  };

  const handleMenuToggle = () => {
    setShowMenu(!showMenu);
  };

  // Format the category labels for display
  const getCategoryLabel = (cat: TimeRange): string => {
    switch (cat) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case '7days': return 'Previous 7 Days';
      case '30days': return 'Previous 30 Days';
    }
  };

  return (
    <div className={className}>
      <IconButton 
        onClick={handleMenuToggle} 
        aria-label="View chat history"
        sx={{ 
          width: { xs: 32, sm: 40 }, 
          height: { xs: 32, sm: 40 }, 
          mr: { xs: 0.5, sm: 1 } 
        }}
      >
        <Menu 
          size={24}
          style={{ 
            width: 'clamp(18px, 4vw, 24px)', 
            height: 'clamp(18px, 4vw, 24px)' 
          }} 
        />
      </IconButton>
      <Drawer anchor="left" open={showMenu} onClose={handleMenuToggle}>
        <Box sx={{ width: 260 }} role="presentation">
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Chat History</Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            {(['today', 'yesterday', '7days', '30days'] as const).map((cat) => (
              <Button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                variant={category === cat ? 'contained' : 'outlined'}
                sx={{ mb: 1 }}
                fullWidth
              >
                {getCategoryLabel(cat)}
              </Button>
            ))}
          </Box>
          <Box sx={{ px: 2, overflowY: 'auto', height: 'calc(100vh - 150px)' }}>
            {error ? (
              <Typography color="error">{error}</Typography>
            ) : isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : history.length > 0 ? (
              <List>
                {history.map((chat) => (
                  <ListItem button key={chat.id} onClick={() => handleHistoryItemClick(chat)}>
                    <ListItemText
                      primary={chat.conversation_title}
                      secondary={new Date(chat.date).toLocaleString()}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">No chat history available.</Typography>
            )}
          </Box>
        </Box>
      </Drawer>
    </div>
  );
};

export default ChatHistory;