import React from 'react';
import Image from 'next/image';
import { Container, Typography } from '@mui/material';

const AccountCreatedConfirmation: React.FC = () => {
  const scimageIcon = process.env.NODE_ENV === 'production'
    ? 'https://solidcam.herokuapp.com/solidcam.png'
    : '/solidcam.png';

  return (
    <Container maxWidth="sm" sx={{ textAlign: 'center', py: 4 }}>
      <Image
        src={scimageIcon}
        alt="SolidCAM Logo"
        width={100}
        height={100}
        style={{ marginBottom: 16 }}
      />
      <Typography variant="h4" component="h1" gutterBottom>
        Account Successfully Created
      </Typography>
      <Typography paragraph>
        Your email has been verified, and your account has been successfully created.
      </Typography>
      <Typography paragraph>You can now log in to your account using the link below:</Typography>
      <Typography paragraph>
        <a href="https://www.solidcamchat.com/" style={{ color: '#0070f3', textDecoration: 'underline' }}>
          Go to SolidCAM Chat Login
        </a>
      </Typography>
    </Container>
  );
}

export default AccountCreatedConfirmation;
