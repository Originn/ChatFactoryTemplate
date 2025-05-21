// pages/password-reset-confirmation.tsx
import Image from 'next/image';
import { Container, Typography } from '@mui/material';

const PRODUCTION_ENV = 'production';
const PRODUCTION_URL = 'https://solidcam.herokuapp.com/';

// Image URLs
let scimageIcon = '/solidcam.png';


if (process.env.NODE_ENV === PRODUCTION_ENV) {
  scimageIcon = `${PRODUCTION_URL}solidcam.png`;
}

export default function PasswordResetConfirmation() {
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
