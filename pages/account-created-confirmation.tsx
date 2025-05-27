import React from 'react';
import Image from 'next/image';
import { Container, Typography } from '@mui/material';
import { getChatbotBranding } from 'utils/logo';

const AccountCreatedConfirmation: React.FC = () => {
  const chatbotBranding = getChatbotBranding();

  return (
    <Container maxWidth="sm" sx={{ textAlign: 'center', py: 4 }}>
      <Image
        src={chatbotBranding.logoUrl}
        alt={`${chatbotBranding.name} Logo`}
        width={100}
        height={100}
        style={{ marginBottom: 16, objectFit: 'contain' }}
        onError={(e) => {
          e.currentTarget.src = '/bot-icon-generic.svg';
        }}
      />
      <Typography variant="h4" component="h1" gutterBottom>
        Account Successfully Created
      </Typography>
      <Typography paragraph>
        Your email has been verified, and your account has been successfully created.
      </Typography>
      <Typography paragraph>You can now log in to your account using the link below:</Typography>
      <Typography paragraph>
        <a href="/" style={{ color: '#0070f3', textDecoration: 'underline' }}>
          Go to {chatbotBranding.name} Login
        </a>
      </Typography>
    </Container>
  );
}

export default AccountCreatedConfirmation;
