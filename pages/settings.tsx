// pages/settings.tsx

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Link from 'next/link';
import Layout from '@/components/core/Layout';
import { auth } from '@/utils/firebase';
import useTheme from '@/hooks/useTheme';
import { LoadingDots } from '@/components/ui/Loaders';
import { ChatHistoryItem } from '@/components/core/Chat/types';
import { getIdToken } from 'firebase/auth';
import {
  Tabs,
  Tab,
  Box,
  Typography,
  Alert,
  Button,
} from '@mui/material';

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
        a.download = `chatbot-data-${new Date().toISOString().split('T')[0]}.json`;
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
    >
      <Box className="settings-container" sx={{ flex: 1, overflowY: 'auto' }}>
        <Box sx={{ mx: 'auto', px: 4, py: 8, maxWidth: 900 }}>
          {/* Back to Chat button */}
          <Box sx={{ mb: 6 }}>
            <Link
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                color: '#1976d2',
                textDecoration: 'none',
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                style={{ marginRight: 4, height: 20, width: 20 }}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Back to Chat
            </Link>
          </Box>

          <Typography variant="h4" component="h1" sx={{ mb: 6 }}>
            Settings & Privacy
          </Typography>

          {/* Status message */}
          {statusMessage && (
            <Alert severity={statusMessage.type} sx={{ mb: 4 }}>
              {statusMessage.text}
            </Alert>
          )}

          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            sx={{ mb: 6, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Your Data" value="data" />
            <Tab label="Privacy Settings" value="privacy" />
            <Tab label="Contact Information" value="contact" />
          </Tabs>

        {activeTab === 'data' && (
<Box>
  <Typography variant="h6" sx={{ mb: 4 }}>
    Your Data
  </Typography>
  <Box sx={{ bgcolor: 'background.paper', p: 6, borderRadius: 1, boxShadow: 1, mb: 6 }}>
    <Typography variant="subtitle1" sx={{ mb: 4 }}>
      Your Data Summary
    </Typography>
    <Typography>Email: {userInfo?.email || 'Loading...'}</Typography>
    <Typography>Chat history items: {dataStats.chatHistoryCount}</Typography>
    <Typography>Account created: {formatDate(userInfo?.createdAt || null)}</Typography>
    <Typography>Last activity: {formatDate(dataStats.lastActive)}</Typography>
  </Box>
  <Box sx={{ bgcolor: 'background.paper', p: 6, borderRadius: 1, boxShadow: 1, mb: 6 }}>
    <Typography variant="subtitle1" sx={{ mb: 2 }}>
      Access and Export Your Data
    </Typography>
    <Typography sx={{ mb: 4 }} color="text.secondary">
      Download a copy of your personal data including your chat history and account information.
    </Typography>
    <Button
      variant="contained"
      color="primary"
      onClick={handleDataExport}
      disabled={loading && processingAction === 'export'}
      sx={{ display: 'flex', alignItems: 'center' }}
    >
      {loading && processingAction === 'export' ? (
        <>
          <span style={{ marginRight: 8 }}>Preparing Export</span>
          <LoadingDots color="#fff" />
        </>
      ) : (
        'Export Your Data'
      )}
    </Button>
  </Box>
  <Box sx={{ bgcolor: 'background.paper', p: 6, borderRadius: 1, boxShadow: 1, mb: 6 }}>
    <Typography variant="subtitle1" sx={{ mb: 2 }}>
      Delete Chat History
    </Typography>
    <Box sx={{ mb: 4 }}>
      <Typography sx={{ mb: 2 }} color="text.secondary">
        Delete your chat history for a specific timeframe. This action only removes your conversation logs from the system but preserves the questions and answers database.
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, fontStyle: 'italic' }} color="text.secondary">
        Note: Q&A pairs are kept for a minimum of 1 month, and you can opt to anonymize them using the settings under <span >Data Retention</span>. Once deleted, your chat history cannot be recovered.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        To request complete deletion of all your data including Q&A history, please contact support with your account email address.
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { sm: 'center' } }}>
      <select
        style={{ padding: '8px', borderRadius: '4px' }}
        value={deleteTimeframe}
        onChange={(e) => setDeleteTimeframe(e.target.value)}
      >
        <option value="all">Delete All History</option>
        <option value="hour">Delete Last Hour</option>
        <option value="day">Delete Last Day</option>
        <option value="week">Delete Last Week</option>
        <option value="month">Delete Last Month</option>
      </select>
      <Button
        variant="contained"
        color="error"
        onClick={handleDeleteChatHistory}
        disabled={loading && processingAction === 'deleteHistory'}
        sx={{ display: 'flex', alignItems: 'center' }}
      >
        {loading && processingAction === 'deleteHistory' ? (
          <>
            <span style={{ marginRight: 8 }}>Deleting</span>
            <LoadingDots color="#fff" />
          </>
        ) : (
          'Delete History'
        )}
      </Button>
    </Box>
  </Box>
  <Box sx={{ bgcolor: 'background.paper', p: 6, borderRadius: 1, boxShadow: 1 }}>
    <Typography variant="subtitle1" sx={{ mb: 2 }}>
      Delete Your Account
    </Typography>
    <Typography sx={{ mb: 4 }} color="text.secondary">
      Permanently delete your account and all associated data. This action cannot be undone.
    </Typography>
    <Button
      variant="contained"
      color="error"
      onClick={handleAccountDeletion}
      disabled={loading && processingAction === 'delete'}
      sx={{ display: 'flex', alignItems: 'center' }}
    >
      {loading && processingAction === 'delete' ? (
        <>
          <span style={{ marginRight: 8 }}>Processing</span>
          <LoadingDots color="#fff" />
        </>
      ) : (
        'Delete Account'
      )}
    </Button>
  </Box>
</Box>
        )}

        {activeTab === 'privacy' && (
          <div>
            <Typography variant="h6" sx={{ mb: 4 }}>Privacy Settings</Typography>
            
            <div >
              <Typography variant="subtitle1" sx={{ mb: 4 }}>Data Collection and Processing</Typography>
              
              <div >
                {/* Removed "Allow Usage Analytics" toggle as per requirement */}
                
                <div >
                  <input 
                    id="storeHistory" 
                    type="checkbox" 
                     
                    checked={privacySettings.storeHistory}
                    onChange={(e) => setPrivacySettings({...privacySettings, storeHistory: e.target.checked})}
                  />
                  <div>
                    <label htmlFor="storeHistory" >Store Chat History</label>
                    <p >
                      Allow us to store your chat history so you can reference past conversations. Disabling will immediately delete your existing history and prevent new conversations from being saved.
                    </p>
                  </div>
                </div>
                
                <div >
                  <p >
                    Note: Usage analytics are now managed through the cookie consent banner. You can adjust these settings at any time through the cookie preferences link in the footer.
                  </p>
                </div>
              </div>
            </div>
            
            <div >
              <Typography variant="subtitle1" sx={{ mb: 2 }}>Data Retention</Typography>
              <p >
                Choose how long we store your information. This applies to both chat history and Q&A data. Changing this will affect existing and future data.
              </p>
              <select 
                
                value={privacySettings.retentionPeriod}
                onChange={(e) => setPrivacySettings({...privacySettings, retentionPeriod: e.target.value})}
              >
                <option value="1month" >1 month (default)</option>
                <option value="3months" >3 months</option>
                <option value="6months" >6 months</option>
                <option value="1year" >1 year</option>
                <option value="forever" >Forever</option>
              </select>
              <p >
                Note: When retention period expires, personal data is anonymized in our knowledge base while preserving the value of Q&A pairs.
              </p>
            </div>
            
            <div>
              <Button
                variant="contained"
                color="primary"
                onClick={handlePrivacySettingsUpdate}
                disabled={loading && processingAction === 'privacy'}
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                {loading && processingAction === 'privacy' ? (
                  <>
                    <span style={{ marginRight: 8 }}>Saving</span>
                    <LoadingDots color="#fff" />
                  </>
                ) : (
                  'Save Privacy Settings'
                )}
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div>
            <Typography variant="h6" sx={{ mb: 4 }}>Contact Information</Typography>
            
            <div >
              <Typography variant="subtitle1" sx={{ mb: 4 }}>GDPR Requests</Typography>
              <p >
                For specific GDPR concerns or requests not handled through this interface, you can contact our data protection team:
              </p>
              
              <div >
                <p >Contact Support</p>
              </div>
              
              <p >
                When contacting us about GDPR matters, please include your account email to help us process your request efficiently.
              </p>
            </div>
            
            <div >
              <Typography variant="subtitle1" sx={{ mb: 4 }}>Legal Information</Typography>
              
              <div >
                <div>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>Privacy Policy</Typography>
                  <p >
                    Our privacy policy details how we collect, process, and protect your data:
                  </p>
                  <Link href="/privacy-policy" >
                    Read our Privacy Policy
                  </Link>
                </div>
                
              </div>
            </div>
          </div>
        )}
        </Box>
      </Box>
    </Layout>
  );
};

export default Settings;