import React from 'react';
import Image from 'next/image';
import { Container, Typography } from '@mui/material';
import { getChatbotBranding } from '../utils/logo';

const VerificationSent: React.FC = () => {
  const chatbotBranding = getChatbotBranding();

  return (
    <Container maxWidth="sm" sx={{ textAlign: 'center', py: 4 }}>
      {chatbotBranding.logoUrl.includes('firebasestorage.googleapis.com') ? (
        <img
          src={chatbotBranding.logoUrl}
          alt={`${chatbotBranding.name} Logo`}
          style={{ maxWidth: 100, maxHeight: 100, marginBottom: 16, objectFit: 'contain' }}
          onError={(e) => {
            e.currentTarget.src = '/bot-icon-generic.svg';
          }}
        />
      ) : (
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
      )}
      <Typography variant="h4" component="h1" gutterBottom>
        Check Your Email
      </Typography>
      <Typography paragraph>
        We&apos;ve sent an email to the address you provided. Please click on the verification link in the email to complete your registration.
      </Typography>
      <Typography paragraph>
        If you don&apos;t see our email shortly, please check your junk or spam folder.
      </Typography>
    </Container>
  );
};

export default VerificationSent;