// pages/settings.tsx

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Link from 'next/link';
import Layout from '@/components/layout';
import { auth } from '@/utils/firebase';
import useTheme from '@/hooks/useTheme';
import LoadingDots from '@/components/ui/LoadingDots';
import { ChatHistoryItem } from '@/components/ChatHistory';
import { getIdToken } from 'firebase/auth';

const Settings = () => {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('data');
  const [loading, setLoading] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [dataStats, setDataStats] = useState<{
    chatHistoryCount: number;
    lastActive: string | null;
    accountCreated: string | null;
  }>({
    chatHistoryCount: 0,
    lastActive: null,
    accountCreated: null
  });
  
  const [privacySettings, setPrivacySettings] = useState({
    allowAnalytics: true,
    storeHistory: true,
    retentionPeriod: 'forever'
  });
  
  const router = useRouter();
  
  useEffect(() => {
    // Check if user is authenticated
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      
      // Set user info first
      setUserInfo({
        email: user.email,
        uid: user.uid,
        createdAt: user.metadata.creationTime
      });
      
      try {
        // Get token here once
        const idToken = await user.getIdToken();
        
        // THEN load data with the token
        await loadUserDataStats(user.email || '', idToken);
        await loadPrivacySettings(user.uid, idToken);
      } catch (error) {
        console.error('Authentication error:', error);
        setStatusMessage({
          type: 'error',
          text: 'Authentication error. Please try logging in again.'
        });
      }
    });
    
    return () => unsubscribe();
  }, [router]);
  
  const loadUserDataStats = async (email: string, idToken: string) => {
    try {
      const response = await fetch(`/api/user-data-stats?email=${encodeURIComponent(email)}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDataStats({
          chatHistoryCount: data.chatHistoryCount || 0,
          lastActive: data.lastActive,
          accountCreated: data.accountCreated
        });
      } else {
        console.error('Error loading data stats:', await response.text());
      }
    } catch (error) {
      console.error('Error loading user data stats:', error);
    }
  };
  
  const loadPrivacySettings = async (uid: string, idToken: string) => {
    try {
      const response = await fetch(`/api/privacy-settings?uid=${encodeURIComponent(uid)}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPrivacySettings({
          allowAnalytics: data.allowAnalytics ?? true,
          storeHistory: data.storeHistory ?? true,
          retentionPeriod: data.retentionPeriod || 'forever'
        });
      } else {
        console.error('Error loading privacy settings:', await response.text());
      }
    } catch (error) {
      console.error('Error loading privacy settings:', error);
    }
  };
  
  const handleDataExport = async () => {
    if (!userInfo?.email) return;
    
    setProcessingAction('export');
    setLoading(true);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Get a fresh token right before the request
      const idToken = await user.getIdToken(true);  // Force refresh
      
      const response = await fetch('/api/export-user-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ email: userInfo.email }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `solidcam-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        
        setStatusMessage({
          type: 'success',
          text: 'Your data has been successfully exported.'
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to export data');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      setStatusMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred while exporting your data.'
      });
    } finally {
      setLoading(false);
      setProcessingAction(null);
    }
  };

  const handleAccountDeletion = async () => {
    if (!userInfo?.email) return;
    
    // First, show a confirmation dialog
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This will permanently remove all your data and cannot be undone.'
    );
    
    if (!confirmed) return;
    
    // Double-check with a second confirmation
    const doubleConfirmed = window.confirm(
      'Please confirm once more. This action will delete ALL your data and your account permanently.'
    );
    
    if (!doubleConfirmed) return;
    
    setProcessingAction('delete');
    setLoading(true);
    
    try {
      // Get the current user's ID token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const idToken = await getIdToken(user);
      
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ email: userInfo.email, uid: userInfo.uid }),
      });
      
      if (response.ok) {
        // Sign out the user
        await auth.signOut();
        
        // Redirect to a confirmation page
        router.push('/account-deleted');
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      setStatusMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred while deleting your account.'
      });
    } finally {
      setLoading(false);
      setProcessingAction(null);
    }
  };
  
  
const handlePrivacySettingsUpdate = async () => {
  if (!userInfo?.uid) return;
  
  setProcessingAction('privacy');
  setLoading(true);
  
  try {
    // Get the current user's ID token
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const idToken = await getIdToken(user);
    
    const response = await fetch('/api/update-privacy-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        uid: userInfo.uid,
        settings: privacySettings
      }),
    });
    
    if (response.ok) {
      setStatusMessage({
        type: 'success',
        text: 'Your privacy settings have been updated successfully.'
      });
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to update privacy settings');
    }
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    setStatusMessage({
      type: 'error',
      text: error instanceof Error ? error.message : 'An error occurred while updating your privacy settings.'
    });
  } finally {
    setLoading(false);
    setProcessingAction(null);
  }
};
  
  // Properly implement navigation functions
  const onHistoryItemClick = (conversation: ChatHistoryItem) => {
    // Navigate back to home page to process the selected conversation
    router.push('/');
  };
  
  const handleNewChat = () => {
    // Navigate back to home page to start a new chat
    router.push('/');
  };
  
  // Format date to a readable format
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Layout 
      theme={theme}
      toggleTheme={toggleTheme}
      onHistoryItemClick={onHistoryItemClick}
      handleNewChat={handleNewChat}
      isFromSolidcamWeb={false}
    >
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back to Chat button */}
        <div className="mb-6">
          <Link href="/" className="flex items-center text-blue-500 hover:text-blue-700 dark:hover:text-blue-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Chat
          </Link>
        </div>
        
        <h1 className="text-2xl font-bold mb-6 dark:text-white">Settings & Privacy</h1>
        
        {/* Status message */}
        {statusMessage && (
          <div className={`mb-4 p-4 rounded text-white ${statusMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            {statusMessage.text}
          </div>
        )}
        
        <div className="flex border-b mb-6">
          <button 
            className={`py-2 px-4 dark:text-white ${activeTab === 'data' ? 'border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            Your Data
          </button>
          <button 
            className={`py-2 px-4 dark:text-white ${activeTab === 'privacy' ? 'border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            Privacy Settings
          </button>
          <button 
            className={`py-2 px-4 dark:text-white ${activeTab === 'contact' ? 'border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('contact')}
          >
            Contact Information
          </button>
        </div>

        {activeTab === 'data' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Your Data</h2>
            
            {/* Data summary */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm mb-6">
              <h3 className="text-lg font-medium mb-4 dark:text-white">Your Data Summary</h3>
              
              <div className="space-y-3">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Email: </span> 
                  <span className="font-medium dark:text-white">{userInfo?.email || 'Loading...'}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Chat history items: </span> 
                  <span className="font-medium dark:text-white">{dataStats.chatHistoryCount}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Account created: </span> 
                  <span className="font-medium dark:text-white">{formatDate(userInfo?.createdAt || null)}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Last activity: </span> 
                  <span className="font-medium dark:text-white">{formatDate(dataStats.lastActive)}</span>
                </div>
              </div>
            </div>
            
            {/* Data export */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm mb-6">
              <h3 className="text-lg font-medium mb-2 dark:text-white">Access and Export Your Data</h3>
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                Download a copy of your personal data including your chat history and account information.
              </p>
              <button 
                onClick={handleDataExport}
                disabled={loading && processingAction === 'export'}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300 flex items-center"
              >
                {loading && processingAction === 'export' ? (
                  <>
                    <span className="mr-2">Preparing Export</span>
                    <LoadingDots color="#fff" />
                  </>
                ) : (
                  'Export Your Data'
                )}
              </button>
            </div>
            
            {/* Account deletion */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium mb-2 dark:text-white">Delete Your Account</h3>
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <button 
                onClick={handleAccountDeletion}
                disabled={loading && processingAction === 'delete'}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:bg-red-300 flex items-center"
              >
                {loading && processingAction === 'delete' ? (
                  <>
                    <span className="mr-2">Processing</span>
                    <LoadingDots color="#fff" />
                  </>
                ) : (
                  'Delete Account'
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Privacy Settings</h2>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm mb-6">
              <h3 className="text-lg font-medium mb-4 dark:text-white">Data Collection and Processing</h3>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <input 
                    id="allowAnalytics" 
                    type="checkbox" 
                    className="mt-1 mr-3" 
                    checked={privacySettings.allowAnalytics}
                    onChange={(e) => setPrivacySettings({...privacySettings, allowAnalytics: e.target.checked})}
                  />
                  <div>
                    <label htmlFor="allowAnalytics" className="font-medium dark:text-white">Allow Usage Analytics</label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      We collect anonymous usage data to improve our service. This helps us understand how the chatbot is used.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <input 
                    id="storeHistory" 
                    type="checkbox" 
                    className="mt-1 mr-3" 
                    checked={privacySettings.storeHistory}
                    onChange={(e) => setPrivacySettings({...privacySettings, storeHistory: e.target.checked})}
                  />
                  <div>
                    <label htmlFor="storeHistory" className="font-medium dark:text-white">Store Chat History</label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Allow us to store your chat history so you can reference past conversations. Disabling will clear your history.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm mb-6">
              <h3 className="text-lg font-medium mb-2 dark:text-white">Data Retention</h3>
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                Choose how long we store your chat history. Changing this will affect future and existing data.
              </p>
              <select 
                className="border dark:border-gray-700 dark:bg-gray-700 dark:text-white p-2 rounded w-full max-w-xs"
                value={privacySettings.retentionPeriod}
                onChange={(e) => setPrivacySettings({...privacySettings, retentionPeriod: e.target.value})}
              >
                <option value="forever" className="bg-white dark:bg-gray-700">Indefinitely (default)</option>
                <option value="1year" className="bg-white dark:bg-gray-700">1 year</option>
                <option value="6months" className="bg-white dark:bg-gray-700">6 months</option>
                <option value="3months" className="bg-white dark:bg-gray-700">3 months</option>
                <option value="1month" className="bg-white dark:bg-gray-700">1 month</option>
              </select>
            </div>
            
            <div className="mt-6">
              <button 
                onClick={handlePrivacySettingsUpdate}
                disabled={loading && processingAction === 'privacy'}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300 flex items-center"
              >
                {loading && processingAction === 'privacy' ? (
                  <>
                    <span className="mr-2">Saving</span>
                    <LoadingDots color="#fff" />
                  </>
                ) : (
                  'Save Privacy Settings'
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Contact Information</h2>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm mb-6">
              <h3 className="text-lg font-medium mb-4 dark:text-white">GDPR Requests</h3>
              <p className="mb-2 text-gray-600 dark:text-gray-400">
                For specific GDPR concerns or requests not handled through this interface, you can contact our data protection team:
              </p>
              
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded mb-4">
                <p className="font-medium dark:text-white">privacy@solidcam.com</p>
              </div>
              
              <p className="text-gray-600 dark:text-gray-400">
                When contacting us about GDPR matters, please include your account email to help us process your request efficiently.
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium mb-4 dark:text-white">Legal Information</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2 dark:text-white">Privacy Policy</h4>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    Our privacy policy details how we collect, process, and protect your data:
                  </p>
                  <Link href="/privacy-policy" className="text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300">
                    Read our Privacy Policy
                  </Link>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2 dark:text-white">Data Processing Agreement</h4>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    For business customers requiring a DPA (Data Processing Agreement), please contact us:
                  </p>
                  <a href="mailto:legal@solidcam.com" className="text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300">
                    legal@solidcam.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Settings;