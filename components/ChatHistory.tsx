import React, { useState, useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import { Message } from '@/types/chat';

interface ChatHistoryProps {
  userEmail: string;
  className?: string;
  onHistoryItemClick: (conversation: ChatHistoryItem) => void;
}

export interface ChatHistoryItem {
    id: number;
    useremail: string;
    date: string;
    conversation_title: string;
    roomId: string;
    conversation_json: string | Message[];
  }

const ChatHistory: React.FC<ChatHistoryProps> = ({ userEmail, className, onHistoryItemClick }) => {
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [category, setCategory] = useState<'today' | 'yesterday' | '7days' | '30days'>('today');
  const [showMenu, setShowMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const fetchChatHistory = async (range: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat-history?userEmail=${encodeURIComponent(userEmail)}&range=${range}`);
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

  useEffect(() => {
    fetchChatHistory(category);
  }, [category, userEmail]);

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

  const handleCategoryChange = (newCategory: 'today' | 'yesterday' | '7days' | '30days') => {
    setCategory(newCategory);
  };

  const handleHistoryItemClick = (chat: ChatHistoryItem) => {
    onHistoryItemClick(chat);
    setShowMenu(false);
  };

  return (
    <div className={`${className} relative`}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
      >
        <Menu size={24} />
      </button>

      {showMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" aria-hidden="true" />
      )}

<div
  ref={sidebarRef}
  className={`fixed top-0 left-0 h-screen w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${
    showMenu ? 'translate-x-0' : '-translate-x-full'
  }`}
>
  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
    <h2 className="text-xl font-semibold">Chat History</h2>
  </div>
  
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
      >
        {cat === 'today' ? 'Today' :
         cat === 'yesterday' ? 'Yesterday' :
         cat === '7days' ? 'Previous 7 Days' : 'Previous 30 Days'}
      </button>
    ))}
  </div>
  
  <div className="p-4 overflow-y-auto h-[calc(100vh-150px)]"> {/* Adjust the height here */}
    {isLoading ? (
      <p className="text-gray-500 dark:text-gray-400">Loading...</p>
    ) : error ? (
      <p className="text-red-500">{error}</p>
    ) : history.length > 0 ? (
      history.map((chat) => (
        <div 
          key={chat.id} 
          className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
          onClick={() => handleHistoryItemClick(chat)}
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