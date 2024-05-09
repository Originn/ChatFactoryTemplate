//components\layout.tsx
import Image from 'next/image';
import { getAuth, signOut } from 'firebase/auth';
import { auth } from 'utils/firebase';

interface LayoutProps {
  children?: React.ReactNode;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

  const handleSignOut = () => {
    signOut(auth).then(() => {
      // Sign-out successful.
      // Update the state of your application or redirect the user
    }).catch((error) => {
      // An error happened.
      console.error("Sign out error:", error);
    });
  };
  
const PRODUCTION_ENV = 'production';
const PRODUCTION_URL = 'https://solidcam.herokuapp.com/';
let moonIcon = '/icons8-moon-50.png';

if (process.env.NODE_ENV === PRODUCTION_ENV) {
  moonIcon = `${PRODUCTION_URL}icons8-moon-50.png`;
}

export default function Layout({ children, theme, toggleTheme }: LayoutProps) {
  return (
    <div className={`flex flex-col min-h-screen mx-auto ${theme === 'dark' ? 'dark' : ''}`}>
      <header className={`sticky top-0 z-40 w-full ${theme === 'light' ? 'bg-white' : 'bg-dark-header'}`}>
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
            {/* Logout button */}
            <button onClick={handleSignOut} className="bg-gray-200 dark:bg-gray-600 p-2 rounded-full ml-4">
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
}