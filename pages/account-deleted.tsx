// pages/account-deleted.tsx

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Container, Typography, Button, Box } from '@mui/material';
import { getTemplateConfig } from '../config/template';

const config = getTemplateConfig();

const AccountDeleted = () => {
  const router = useRouter();
  
  return (
    <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
      <Box mb={3} display="flex" justifyContent="center">
        <Image src="/bot-icon-generic.svg" alt={`${config.productName} Logo`} width={150} height={150} style={{ marginBottom: 16 }} />
      </Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Account Successfully Deleted
      </Typography>
      <Box sx={{ backgroundColor: 'green.100', border: 1, borderColor: 'green.200', borderRadius: 1, p: 2, mb: 3 }}>
        <Typography color="green.800">
          Your account and all associated data have been permanently deleted in accordance with GDPR requirements.
        </Typography>
      </Box>
      <Typography color="text.secondary" paragraph>
        Thank you for using {config.productName} ChatBot. If you change your mind, you're always welcome to create a new account.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 4 }}>
        <Button component={Link} href="/" variant="contained" fullWidth>
          Return to Home Page
        </Button>
        <Button onClick={() => window.close()} variant="outlined" fullWidth>
          Close Window
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary">
        For any questions about data policies, please contact{' '}
        <a href={`mailto:${config.supportEmail}`} style={{ color: '#1976d2' }}>
          {config.supportEmail}
        </a>
      </Typography>
    </Container>
  );
};

export default AccountDeleted;