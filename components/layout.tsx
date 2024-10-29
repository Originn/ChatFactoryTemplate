import Image from 'next/image';
import { signOut } from 'firebase/auth';
import { auth } from '@/utils/firebase';
import ChatHistory, { ChatHistoryItem } from './ChatHistory';
import { FC } from 'react';
import Tooltip from './Tooltip';

interface LayoutProps {
  children?: React.ReactNode;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onHistoryItemClick: (conversation: ChatHistoryItem) => void;
  handleNewChat: () => void;
}

const PRODUCTION_ENV = 'production';
const PRODUCTION_URL = 'https://solidcam.herokuapp.com/';
let moonIcon = '/icons8-moon-50.png';

if (process.env.NODE_ENV === PRODUCTION_ENV) {
  moonIcon = `${PRODUCTION_URL}icons8-moon-50.png`;
}

const Layout: FC<LayoutProps> = ({ children, theme, toggleTheme, onHistoryItemClick, handleNewChat }) => {
  const userEmail = auth.currentUser ? auth.currentUser.email : '';

  const handleSignOut = () => {
    signOut(auth).then(() => {
    }).catch((error) => {
      console.error("Sign out error:", error);
    });
  };

  const iconButtonClass = "w-10 h-10 flex items-center justify-center bg-gray-200 dark:bg-gray-600 rounded-full mr-4";
  const logoutButtonClass = "px-4 h-10 flex items-center justify-center bg-gray-200 dark:bg-gray-600 rounded-full";
  const newChatButtonClass = "w-10 h-10 flex items-center justify-center bg-blue-500 text-white rounded-full mr-4"; // Same size as Chat History button

  return (
    <div className={`flex flex-col min-h-screen mx-auto ${theme === 'dark' ? 'dark' : ''}`}>
      <header className={`sticky top-0 z-40 w-full ${theme === 'light' ? 'bg-white' : 'bg-dark-header'}`}>
        <div className="h-16 border-b border-b-slate-200 py-4">
          <nav className="ml-4 pl-6 flex items-center justify-start">
            {userEmail && (
              <div className={iconButtonClass}>
                <Tooltip message="View chat history">
                  <ChatHistory
                    userEmail={userEmail}
                    className="relative z-50"
                    onHistoryItemClick={onHistoryItemClick}
                  />
                </Tooltip>
              </div>
            )}
            
            {/* Start New Chat Icon Button */}
            <Tooltip message="Start a new chat">
              <button onClick={handleNewChat} className={newChatButtonClass}>
                <Image
                  src="/new-chat.png"
                  alt="Start New Chat"
                  width={24}
                  height={24}
                />
              </button>
            </Tooltip>

            {/* Theme Toggle Button with dynamic tooltip */}
            <Tooltip message={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              <button onClick={toggleTheme} className={iconButtonClass}>
                {theme === 'dark' ? (
                  <Image src="icons8-sun.svg" alt="Sun Icon" width={24} height={24} />
                ) : (
                  <Image src={moonIcon} alt="Moon Icon" width={24} height={24} />
                )}
              </button>
            </Tooltip>

            {/* Logout Button */}
            <button onClick={handleSignOut} className={logoutButtonClass}>
              Logout
            </button>
          </nav>
        </div>
      </header>
      <div>
        <main className="flex flex-col flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
