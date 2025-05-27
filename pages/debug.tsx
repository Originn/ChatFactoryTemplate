import { GetServerSideProps } from 'next';
import { Container, Typography, Box, Paper } from '@mui/material';
import Head from 'next/head';

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
        </Paper>

        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Logo Test
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {envVars.NEXT_PUBLIC_CHATBOT_LOGO_URL && (
              <Box>
                <Typography variant="body2" gutterBottom>Custom Logo:</Typography>
                <img 
                  src={envVars.NEXT_PUBLIC_CHATBOT_LOGO_URL} 
                  alt="Custom Logo Test"
                  style={{ maxWidth: 100, maxHeight: 100, border: '1px solid #ccc' }}
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
      </Container>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  const showDebug = process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_PAGE === 'true';
  
  if (!showDebug) {
    return { notFound: true };
  }

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
