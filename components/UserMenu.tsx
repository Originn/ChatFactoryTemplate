// components/UserMenu.tsx

import React, { useState, useRef, useEffect } from 'react';
import { auth } from '@/utils/firebase';
import { useRouter } from 'next/router';

interface UserMenuProps {
  className?: string;
}

const UserMenu: React.FC<UserMenuProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userInitials, setUserInitials] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
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

  // Handle click outside to close the menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSettingsClick = () => {
    setIsOpen(false);
    router.push('/settings');
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/login'); // Redirect to login page after logout
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      <button
        className="flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
      >
        {userInitials}
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-10">
          {userEmail && (
            <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
              {userEmail}
            </div>
          )}
          
          {/* Settings & Privacy */}
          <button
            onClick={handleSettingsClick}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Settings & Privacy
          </button>
          
          <div className="border-t border-gray-200"></div>
          
          <button
            onClick={handleLogout}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;