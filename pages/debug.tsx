import { GetServerSideProps } from 'next';
import { Container, Typography, Box, Paper, Divider, Button } from '@mui/material';
import Head from 'next/head';
import { useState } from 'react';

interface DebugPageProps {
  envVars: Record<string, string>;
  buildTime: string;
}

export default function DebugPage({ envVars, buildTime }: DebugPageProps) {
  const [imageTestResult, setImageTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const testImageUrl = async () => {
    if (!envVars.NEXT_PUBLIC_CHATBOT_LOGO_URL) {
      alert('No logo URL to test');
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/test-image-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: envVars.NEXT_PUBLIC_CHATBOT_LOGO_URL })
      });
      
      const result = await response.json();
      setImageTestResult(result);
    } catch (error) {
      setImageTestResult({ success: false, error: (error as Error).message });
    } finally {
      setTesting(false);
    }
  };

interface DebugPageProps {
  envVars: Record<string, string>;
  buildTime: string;
}

export default function DebugPage({ envVars, buildTime }: DebugPageProps) {
  return (
    <>
      <Head>
        <title>Debug - Environment Variables</title>
      </Head>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          🔍 Debug Information
        </Typography>
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Build Time: {buildTime}
        </Typography>
        
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Chatbot Environment Variables
          </Typography>
          
          <Box sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
            {Object.entries(envVars)
              .filter(([key]) => key.startsWith('NEXT_PUBLIC_CHATBOT_'))
              .map(([key, value]) => (
                <Box key={key} sx={{ mb: 1 }}>
                  <strong>{key}:</strong> {value || '(empty)'}
                </Box>
              ))
            }
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="h6" gutterBottom>
            All Public Environment Variables
          </Typography>
          
          <Box sx={{ fontFamily: 'monospace', fontSize: '0.875rem', maxHeight: 400, overflow: 'auto' }}>
            {Object.entries(envVars)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => (
                <Box key={key} sx={{ mb: 1 }}>
                  <strong>{key}:</strong> {value || '(empty)'}
                </Box>
              ))
            }
          </Box>
        </Paper>
        
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Logo Test & Diagnostics
          </Typography>
          
          {envVars.NEXT_PUBLIC_CHATBOT_LOGO_URL && (
            <>
              <Typography variant="body2" gutterBottom>
                <strong>Logo URL:</strong> {envVars.NEXT_PUBLIC_CHATBOT_LOGO_URL}
              </Typography>
              
              <Button 
                variant="contained" 
                onClick={testImageUrl} 
                disabled={testing}
                sx={{ mb: 2 }}
              >
                {testing ? 'Testing...' : 'Test Logo URL'}
              </Button>
              
              {imageTestResult && (
                <Box sx={{ mt: 2, p: 2, backgroundColor: imageTestResult.success ? 'success.light' : 'error.light', borderRadius: 1 }}>
                  <Typography variant="body2">
                    <strong>Test Result:</strong> {imageTestResult.success ? '✅ Success' : '❌ Failed'}
                  </Typography>
                  {imageTestResult.status && (
                    <Typography variant="body2">
                      <strong>HTTP Status:</strong> {imageTestResult.status}
                    </Typography>
                  )}
                  {imageTestResult.error && (
                    <Typography variant="body2">
                      <strong>Error:</strong> {imageTestResult.error}
                    </Typography>
                  )}
                  {imageTestResult.headers && (
                    <details>
                      <summary>Response Headers</summary>
                      <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                        {JSON.stringify(imageTestResult.headers, null, 2)}
                      </pre>
                    </details>
                  )}
                </Box>
              )}
            </>
          )}
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mt: 2 }}>
            {envVars.NEXT_PUBLIC_CHATBOT_LOGO_URL && (
              <Box>
                <Typography variant="body2" gutterBottom>Custom Logo:</Typography>
                <img 
                  src={envVars.NEXT_PUBLIC_CHATBOT_LOGO_URL} 
                  alt="Custom Logo Test"
                  style={{ maxWidth: 100, maxHeight: 100, border: '1px solid #ccc' }}
                  onError={(e) => {
                    console.error('Custom logo failed to load');
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </Box>
            )}
            
            <Box>
              <Typography variant="body2" gutterBottom>Fallback Logo:</Typography>
              <img 
                src="/bot-icon-generic.svg" 
                alt="Fallback Logo"
                style={{ maxWidth: 100, maxHeight: 100, border: '1px solid #ccc' }}
              />
            </Box>
          </Box>
        </Paper>
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          ⚠️ This page should only be accessible in development or for debugging purposes.
          Remove it before production deployment.
        </Typography>
      </Container>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  // Only show in development or if specifically enabled
  const showDebug = process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_PAGE === 'true';
  
  if (!showDebug) {
    return {
      notFound: true
    };
  }

  // Get all environment variables that start with NEXT_PUBLIC_
  const envVars: Record<string, string> = {};
  
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('NEXT_PUBLIC_')) {
      envVars[key] = process.env[key] || '';
    }
  });

  return {
    props: {
      envVars,
      buildTime: new Date().toISOString()
    }
  };
};
