//layout.tsx
import { useUser } from '@auth0/nextjs-auth0/client';
import Link from 'next/link';
import Image from 'next/image';

interface LayoutProps {
  children?: React.ReactNode;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const PRODUCTION_ENV = 'production';
const PRODUCTION_URL = 'https://solidcam.herokuapp.com/';
let moonIcon = '/icons8-moon-50.png';

if (process.env.NODE_ENV === PRODUCTION_ENV) {
  moonIcon = `${PRODUCTION_URL}icons8-moon-50.png`;
}

export default function Layout({ children, theme, toggleTheme }: LayoutProps) {
  const { user } = useUser(); // Add this line to get user information
  return (
    <div className={`mx-auto flex flex-col space-y-4 ${theme === 'dark' ? 'dark' : ''}`}>
      <header className={`w-full sticky top-0 z-40 ${theme === 'light' ? 'bg-white' : 'bg-dark-header'}`}>
        <div className="h-16 border-b border-b-slate-200 py-4">
          <nav className="ml-4 pl-6 flex items-center justify-start">
            <button onClick={toggleTheme} className="bg-gray-200 dark:bg-gray-600 p-2 rounded-full ml-4">
              {theme === 'dark' ? (
                // Use Image component for Moon icon
                <Image src="icons8-sun.svg" alt="Sun Icon" width={24} height={24} />
              ) : (
                // Use Image component for Sun icon
                <Image src={moonIcon} alt="Moon Icon" width={24} height={24} />
              )}
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