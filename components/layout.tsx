import Image from 'next/image';
import { signOut } from 'firebase/auth';
import { auth } from '@/utils/firebase';
import ChatHistory, { ChatHistoryItem } from './ChatHistory';
import { FC } from 'react';
import Tooltip from './Tooltip';
import UserMenu from './UserMenu';

interface LayoutProps {
  children?: React.ReactNode;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onHistoryItemClick: (conversation: ChatHistoryItem) => void;
  handleNewChat: () => void;
  isFromSolidcamWeb?: boolean; // Add this prop
}

const PRODUCTION_ENV = 'production';
const PRODUCTION_URL = 'https://solidcam.herokuapp.com/';
let moonIcon = '/icons8-moon-50.png';

if (process.env.NODE_ENV === PRODUCTION_ENV) {
  moonIcon = `${PRODUCTION_URL}icons8-moon-50.png`;
}

const Layout: FC<LayoutProps> = ({ 
  children, 
  theme, 
  toggleTheme, 
  onHistoryItemClick, 
  handleNewChat,
  isFromSolidcamWeb 
}) => {
  const userEmail = auth.currentUser ? auth.currentUser.email : '';

  const iconButtonClass = "w-10 h-10 flex items-center justify-center bg-gray-200 dark:bg-gray-600 rounded-full mr-4";
  const newChatButtonClass = "w-10 h-10 flex items-center justify-center bg-blue-500 text-white rounded-full mr-4";

  return (
    <div className={`flex flex-col min-h-screen mx-auto`}>
      <header className={`sticky top-0 z-40 w-full ${theme === 'light' ? 'bg-white' : 'bg-dark-header'}`}>
        <div className="h-16 border-b border-b-slate-200 py-4">
          <div className="mx-4 px-6 flex items-center justify-between">
            {/* Left side navigation */}
            <div className="flex items-center">
              {/* Only show Chat History for non-solidcam.com users */}
              {userEmail && !isFromSolidcamWeb && (
                <div className={iconButtonClass}>
                  <Tooltip message="View chat history" hideOnClick={true}>
                    <ChatHistory
                      userEmail={userEmail}
                      className="relative z-50"
                      onHistoryItemClick={onHistoryItemClick}
                    />
                  </Tooltip>
                </div>
              )}

              {/* New Chat button - shown for all users */}
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

              {/* Theme Toggle Button - show for all users */}
              <Tooltip message={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                <button onClick={toggleTheme} className={iconButtonClass}>
                  {theme === 'dark' ? (
                    <Image src="icons8-sun.svg" alt="Sun Icon" width={24} height={24} />
                  ) : (
                    <Image src={moonIcon} alt="Moon Icon" width={24} height={24} />
                  )}
                </button>
              </Tooltip>
            </div>

            {/* Right side navigation - User Menu */}
            {!isFromSolidcamWeb && userEmail && (
              <UserMenu className="ml-auto" />
            )}
          </div>
        </div>
      </header>
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;