// pages/account-deleted.tsx

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';

const AccountDeleted = () => {
  const router = useRouter();
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="flex justify-center mb-6">
          <Image 
            src="/solidcam.png" 
            alt="SolidCAM Logo" 
            width={150} 
            height={150} 
            className="mb-4" 
          />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Account Successfully Deleted</h1>
        
        <div className="bg-green-100 border border-green-200 rounded-md p-4 mb-6">
          <p className="text-green-800">
            Your account and all associated data have been permanently deleted in accordance with GDPR requirements.
          </p>
        </div>
        
        <p className="text-gray-600 mb-6">
          Thank you for using SolidCAM ChatBot. If you change your mind, you're always welcome to create a new account.
        </p>
        
        <div className="flex flex-col space-y-3">
          <Link href="/" className="w-full inline-block bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition duration-150">
            Return to Home Page
          </Link>
          
          <button
            onClick={() => window.close()}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded transition duration-150"
          >
            Close Window
          </button>
        </div>
      </div>
      
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          For any questions about data policies, please contact{' '}
          <a href="mailto:ai@solidcam.app" className="text-blue-500 hover:underline">
            ai@solidcam.app
          </a>
        </p>
      </div>
    </div>
  );
};

export default AccountDeleted;