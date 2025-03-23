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
  const [aiProvider, setAiProvider] = useState('openai'); // Default AI provider
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
    storeHistory: true,
    retentionPeriod: '1month' // Changed default to 1 month per GDPR requirements
  });

  // New state for delete history dropdown
  const [deleteTimeframe, setDeleteTimeframe] = useState('all');
  
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
          storeHistory: data.storeHistory ?? true,
          retentionPeriod: data.retentionPeriod || '1month' // Changed default to 1 month
        });
        
        // Also set the AI provider if it exists
        if (data.aiProvider) {
          setAiProvider(data.aiProvider);
        }
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

  // New function to handle chat history deletion
  const handleDeleteChatHistory = async () => {
    if (!userInfo?.email) return;
    
    // Confirm deletion with user
    const confirmed = window.confirm(
      `Are you sure you want to delete your chat history for the selected timeframe? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    setProcessingAction('deleteHistory');
    setLoading(true);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const idToken = await getIdToken(user);
      
      const response = await fetch('/api/delete-chat-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          email: userInfo.email,
          timeframe: deleteTimeframe
        }),
      });
      
      if (response.ok) {
        // Refresh user data stats to reflect the deletion
        await loadUserDataStats(userInfo.email, idToken);
        
        setStatusMessage({
          type: 'success',
          text: 'Your chat history has been successfully deleted for the selected timeframe.'
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete chat history');
      }
    } catch (error) {
      console.error('Error deleting chat history:', error);
      setStatusMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred while deleting your chat history.'
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

// Handler for saving AI provider setting
const handleAiProviderUpdate = async () => {
  if (!userInfo?.uid) return;
  
  setProcessingAction('aiProvider');
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
        settings: {
          storeHistory: privacySettings.storeHistory,
          retentionPeriod: privacySettings.retentionPeriod,
          aiProvider: aiProvider
        }
      }),
    });
    
    if (response.ok) {
      setStatusMessage({
        type: 'success',
        text: 'Your AI provider preference has been updated successfully.'
      });
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to update AI provider');
    }
  } catch (error) {
    console.error('Error updating AI provider:', error);
    setStatusMessage({
      type: 'error',
      text: error instanceof Error ? error.message : 'An error occurred while updating your AI provider.'
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


  useEffect(() => {
    // Add the settings-page class to body when component mounts
    document.body.classList.add('settings-page');
    
    // Make sure we don't mess with the theme classes
    const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
    document.body.classList.add(currentTheme);
    
    return () => {
      // Remove the settings-page class when component unmounts
      document.body.classList.remove('settings-page');
    };
  }, []);

  return (
    <Layout 
      theme={theme}
      toggleTheme={toggleTheme}
      onHistoryItemClick={onHistoryItemClick}
      handleNewChat={handleNewChat}
      isFromSolidcamWeb={false}
    >
    <div className="flex-1 overflow-y-auto settings-container">
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
            className={`py-2 px-4 dark:text-white ${activeTab === 'aiprovider' ? 'border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('aiprovider')}
          >
            AI Provider
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
            
            {/* NEW: Delete Chat History */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm mb-6">
              <h3 className="text-lg font-medium mb-2 dark:text-white">Delete Chat History</h3>
              <div className="mb-4">
                <p className="mb-2 text-gray-600 dark:text-gray-400">
                    Delete your chat history for a specific timeframe. This action only removes your conversation logs from the system but preserves the questions and answers database.
                </p>
                <p className="text-sm mb-3 text-gray-500 dark:text-gray-500 italic">
                    Note: Q&A pairs are kept for a minimum of 1 month, and you can opt to anonymize them using the settings under <span className="font-medium">Data Retention</span>. Once deleted, your chat history cannot be recovered.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                    To request complete deletion of all your data including Q&A history, please email <a href="mailto:ai@solidcam.app" className="text-blue-500 hover:underline">ai@solidcam.app</a> with your account email address.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <select
                  className="border dark:border-gray-700 dark:bg-gray-700 dark:text-white p-2 rounded"
                  value={deleteTimeframe}
                  onChange={(e) => setDeleteTimeframe(e.target.value)}
                >
                  <option value="all" className="bg-white dark:bg-gray-700">Delete All History</option>
                  <option value="hour" className="bg-white dark:bg-gray-700">Delete Last Hour</option>
                  <option value="day" className="bg-white dark:bg-gray-700">Delete Last Day</option>
                  <option value="week" className="bg-white dark:bg-gray-700">Delete Last Week</option>
                  <option value="month" className="bg-white dark:bg-gray-700">Delete Last Month</option>
                </select>
                <button 
                  onClick={handleDeleteChatHistory}
                  disabled={loading && processingAction === 'deleteHistory'}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:bg-red-300 flex items-center"
                >
                  {loading && processingAction === 'deleteHistory' ? (
                    <>
                      <span className="mr-2">Deleting</span>
                      <LoadingDots color="#fff" />
                    </>
                  ) : (
                    'Delete History'
                  )}
                </button>
              </div>
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
                {/* Removed "Allow Usage Analytics" toggle as per requirement */}
                
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
                      Allow us to store your chat history so you can reference past conversations. Disabling will immediately delete your existing history and prevent new conversations from being saved.
                    </p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Note: Usage analytics are now managed through the cookie consent banner. You can adjust these settings at any time through the cookie preferences link in the footer.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm mb-6">
              <h3 className="text-lg font-medium mb-2 dark:text-white">Data Retention</h3>
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                Choose how long we store your information. This applies to both chat history and Q&A data. Changing this will affect existing and future data.
              </p>
              <select 
                className="border dark:border-gray-700 dark:bg-gray-700 dark:text-white p-2 rounded w-full max-w-xs"
                value={privacySettings.retentionPeriod}
                onChange={(e) => setPrivacySettings({...privacySettings, retentionPeriod: e.target.value})}
              >
                <option value="1month" className="bg-white dark:bg-gray-700">1 month (default)</option>
                <option value="3months" className="bg-white dark:bg-gray-700">3 months</option>
                <option value="6months" className="bg-white dark:bg-gray-700">6 months</option>
                <option value="1year" className="bg-white dark:bg-gray-700">1 year</option>
                <option value="forever" className="bg-white dark:bg-gray-700">Forever</option>
              </select>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Note: When retention period expires, personal data is anonymized in our knowledge base while preserving the value of Q&A pairs.
              </p>
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

        {activeTab === 'aiprovider' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 dark:text-white">AI Provider Settings</h2>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm mb-6">
              <h3 className="text-lg font-medium mb-4 dark:text-white">Select AI Provider</h3>
              
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                Choose the AI provider that will power your chat experience. Different providers may offer varied capabilities and response styles.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <input 
                    id="openai" 
                    type="radio" 
                    name="aiProvider"
                    value="openai"
                    className="mr-3" 
                    checked={aiProvider === 'openai'}
                    onChange={() => setAiProvider('openai')}
                  />
                  <div>
                    <label htmlFor="openai" className="font-medium dark:text-white">OpenAI</label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Powered by OpenAI's advanced language models.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <input 
                    id="deepseek" 
                    type="radio" 
                    name="aiProvider"
                    value="deepseek"
                    className="mr-3" 
                    checked={aiProvider === 'deepseek'}
                    onChange={() => setAiProvider('deepseek')}
                  />
                  <div>
                    <label htmlFor="deepseek" className="font-medium dark:text-white">DeepSeek</label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Powered by DeepSeek's efficient and powerful language models.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <button 
                  onClick={handleAiProviderUpdate}
                  disabled={loading && processingAction === 'aiProvider'}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300 flex items-center"
                >
                  {loading && processingAction === 'aiProvider' ? (
                    <>
                      <span className="mr-2">Saving</span>
                      <LoadingDots color="#fff" />
                    </>
                  ) : (
                    'Save AI Provider Setting'
                  )}
                </button>
              </div>
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
                <p className="font-medium dark:text-white">ai@solidcam.app</p>
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
                
              </div>
            </div>
          </div>
        )}
    </div>
    </div>
    </Layout>
  );
};

export default Settings;