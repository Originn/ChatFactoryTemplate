import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';

interface ThemeContextValue {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
});

const useThemeState = (initialTheme?: 'light' | 'dark') => {
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
    
    // Set data-theme attribute for CSS targeting
    document.documentElement.setAttribute('data-theme', theme);
    
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
    
    // Force background color update
    document.body.style.backgroundColor = theme === 'dark' ? '#000000' : '#f8fafc';
    document.body.style.color = theme === 'dark' ? '#f1f5f9' : '#1e293b';
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

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const themeState = useThemeState();
  return (
    <ThemeContext.Provider value={themeState}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default useTheme;