import { useState, useEffect } from 'react';

export const useTheme = (initialTheme?: 'light' | 'dark') => {
  // Use initialTheme from props if available, otherwise check localStorage
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (initialTheme) {
      return initialTheme;
    }
    
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    
    return 'light';
  });

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme && !initialTheme) {
      setTheme(savedTheme);
    } else if (!savedTheme) {
      window.localStorage.setItem('theme', 'light');
    }
  }, [initialTheme]);

  useEffect(() => {
    window.localStorage.setItem('theme', theme);
    
    // Update both document elements to ensure consistency
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const handleStorageChange = () => {
      const updatedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
      setTheme(updatedTheme);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return { theme, toggleTheme };
};

export default useTheme;