import React from 'react';
import Image from 'next/image';
import { Container, Typography } from '@mui/material';

const VerificationSent: React.FC = () => {
  return (
    <Container maxWidth="sm" sx={{ textAlign: 'center', py: 4 }}>
      <Image
        src="/solidcam.png"
        alt="SolidCAM Logo"
        width={100}
        height={100}
        style={{ marginBottom: 16 }}
      />
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