import { useState, useEffect } from 'react';

export function useTheme(defaultTheme = 'light') {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Try to get the saved theme from localStorage or default to the specified default theme
    return localStorage.getItem('theme') as 'light' | 'dark' || defaultTheme;
  });

  useEffect(() => {
    const handleStorageChange = () => {
        // Update theme based on localStorage value if it changes externally
        const updatedTheme = localStorage.getItem('theme') as 'light' | 'dark' || defaultTheme;
        setTheme(updatedTheme);
    };

    // Subscribe to storage events
    window.addEventListener('storage', handleStorageChange);

    // Initialize theme from local storage or default
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || defaultTheme;
    if (!savedTheme) {
        localStorage.setItem('theme', defaultTheme);
    } else {
        setTheme(savedTheme);
    }

    // Cleanup the event listener when the component unmounts
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, [defaultTheme]);

  useEffect(() => {
    // Apply the theme to the body element of the document
    document.body.className = theme;
    // Update local storage when theme changes
    localStorage.setItem('theme', theme);
  }, [theme]);

  return [theme, setTheme] as const;
}
