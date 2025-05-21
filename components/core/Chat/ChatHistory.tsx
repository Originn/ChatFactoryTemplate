import React, { useState, useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
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
  const sidebarRef = useRef<HTMLDivElement>(null);

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

  // Click outside handler to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
    <div className={`${className} relative`}>
      <button
        onClick={handleMenuToggle}
        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
        aria-label="View chat history"
        aria-expanded={showMenu}
      >
        <Menu size={24} />
      </button>

      {/* Overlay when menu is open */}
      {showMenu && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40" 
          aria-hidden="true" 
        />
      )}

      {/* Sidebar menu */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-screen w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${
          showMenu ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Chat history sidebar"
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">Chat History</h2>
        </div>

        {/* Time range filters */}
        <div className="flex flex-col p-4 space-y-2">
          {(['today', 'yesterday', '7days', '30days'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                category === cat
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
              }`}
              aria-current={category === cat ? 'true' : 'false'}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>

        {/* History items */}
        <div className="p-4 overflow-y-auto h-[calc(100vh-150px)] pb-4">
          {error ? (
            <p className="text-red-500">{error}</p>
          ) : isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
            </div>
          ) : history.length > 0 ? (
            history.map((chat) => (
              <div
                key={chat.id}
                className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 flex flex-col"
                onClick={() => handleHistoryItemClick(chat)}
                role="button"
                tabIndex={0}
                aria-label={`Chat: ${chat.conversation_title}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleHistoryItemClick(chat);
                  }
                }}
              >
                <h3 className="text-sm font-semibold">{chat.conversation_title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(chat.date).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No chat history available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHistory;