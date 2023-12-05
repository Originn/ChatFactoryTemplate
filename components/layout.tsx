//layout.tsx
import { useUser } from '@auth0/nextjs-auth0/client';
import Link from 'next/link';

interface LayoutProps {
  children?: React.ReactNode;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export default function Layout({ children, theme, toggleTheme }: LayoutProps) {
  const { user } = useUser(); // Add this line to get user information

  return (
    <div className={`mx-auto flex flex-col space-y-4 ${theme === 'dark' ? 'dark' : ''}`}>
      <header className={`w-full sticky top-0 z-40 ${theme === 'light' ? 'bg-white' : 'bg-dark-header'}`}>
        <div className="h-16 border-b border-b-slate-200 py-4">
          <nav className="ml-4 pl-6 flex items-center justify-start">
            <a href="#" className="hover:text-slate-600 cursor-pointer">
              Home
            </a>
            <button 
              onClick={toggleTheme} 
              className="ml-10 px-4 py-2 border rounded text-sm focus:outline-none transition-colors duration-200 hover:bg-opacity-10"
              style={{ 
                backgroundColor: theme === 'light' ? '#000' : '#FFF', 
                color: theme === 'light' ? '#FFF' : '#000'
              }}
            >
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </button>
            {user && (
              <Link href="/api/auth/logout" className="ml-4 hover:text-slate-600 cursor-pointer">
                Logout
              </Link>
            )}
          </nav>
        </div>
      </header>
      <div>
        <main className="flex w-full flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}