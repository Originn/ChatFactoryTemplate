// pages/verification-sent.js
import Image from 'next/image';

export default function VerificationSent() {
    // Inline styles
    const containerStyle = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh', // Use full viewport height
      textAlign: 'center'
    };
  
    const headerStyle = {
      fontSize: '2em', // Larger font size
      fontWeight: 'bold', // Bold font weight
    };
  
    const paragraphStyle = {
      fontSize: '1.2em', // Slightly larger font size
    };
  
    const imageStyle = {
      maxWidth: '100px', // Set a max width for your image
      marginBottom: '20px', // Margin below the image
    };
  
    return (
      <div style={containerStyle}>
        <Image 
          src="/solidcam.png" // Replace with the path to your image
          alt="solidcam"
          style={imageStyle}
        />
        <h1 style={headerStyle}>Check Your Email</h1>
        <p style={paragraphStyle}>
          We've sent an email to the address you provided. Please click on the verification link in the email to complete your registration.
        </p>
      </div>
    );
  }
  