import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Container, Typography, Button } from '@mui/material';
import { getTemplateConfig } from '../config/template';

const config = getTemplateConfig();

const VerificationFailed: React.FC = () => {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Retrieve the email from sessionStorage
    const storedEmail = sessionStorage.getItem('verificationFailedEmail');
    if (storedEmail) {
      setEmail(storedEmail);
    } else {
      // If no email is found, redirect to the homepage or handle appropriately
      router.replace('/');
    }
  }, [router]);

  const handleResendVerification = () => {
    if (email) {
      // Example: Make an API call or use Firebase to resend the verification email
      alert(`A new verification email has been sent to ${email}.`);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ textAlign: 'center', py: 4 }}>
      <Image
        src="/bot-icon-generic.svg"
        alt={`${config.productName} Logo`}
        width={100}
        height={100}
        style={{ marginBottom: 16 }}
      />
      <Typography variant="h4" component="h1" gutterBottom>
        Verification Failed
      </Typography>
      <Typography paragraph>
        It seems that your email verification link has expired or is invalid.
      </Typography>
      <Typography paragraph>
        Please click the button below to send a new verification email to {email}.
      </Typography>
      <Button variant="contained" onClick={handleResendVerification} sx={{ mt: 2 }}>
        Resend Verification Email
      </Button>
    </Container>
  );
}

export default VerificationFailed;
