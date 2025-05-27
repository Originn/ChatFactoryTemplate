// pages/password-reset-confirmation.tsx
import Image from 'next/image';
import { Container, Typography } from '@mui/material';
import { getChatbotBranding } from 'utils/logo';

export default function PasswordResetConfirmation() {
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
        Reset Your Password
      </Typography>
      <Typography paragraph>
        We&apos;ve sent a link to your email address. Please check your inbox and follow the instructions to reset your password.
      </Typography>
      <Typography paragraph>
        If you don&apos;t see the email, please check your spam or junk mail folder.
      </Typography>
    </Container>
  );
}
