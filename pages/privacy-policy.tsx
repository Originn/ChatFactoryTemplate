// pages/privacy-policy.tsx
import Image from 'next/image';
import Link from 'next/link';
import { Container, Typography, Box } from '@mui/material';

const PRODUCTION_ENV = 'production';

// Image URL - use relative path for all environments
let scimageIcon = '/bot-icon-generic.svg'; // Use existing generic bot icon

export default function PrivacyPolicy() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={2} textAlign="center">
        <Link href="/">
          <Image src={scimageIcon} alt="SolidCAM Logo" width={100} height={100} style={{ borderRadius: '50%' }} />
        </Link>
      </Box>
      <Box sx={{ maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', px: 1 }}>
      <Typography variant="h4" component="h1" align="center" gutterBottom>Privacy Policy for SolidCAM ChatBot</Typography>
      <Typography variant="h6" component="h2" align="center" gutterBottom>Effective Date: 27th February 2025</Typography>
      <Typography paragraph>
        SolidCAM ChatBot utilizes leading-edge language learning models (LLMs) to provide responsive and accurate answers to users&apos; inquiries regarding SolidCAM software. This document outlines our commitment to your privacy and details the measures we take to protect the personal information you share with us while interacting with our service.
      </Typography>

      <Typography variant="h6" component="h3" gutterBottom>Information Collection</Typography>
      <Typography paragraph>
        <strong>Personal Data Collection:</strong> We collect personal data that includes your email address, which facilitates communication and personalization of our service. Additionally, we log the queries you submit and the corresponding responses provided by the ChatBot to refine and enhance the accuracy of our tool.
      </Typography>
      <Typography paragraph>
        <strong>Interaction Logs:</strong> Every interaction with our ChatBot, including the timestamp of each session, is meticulously logged to help improve response relevance and timeliness.
      </Typography>
      <Typography paragraph>
        <strong>Comments and Feedback:</strong> We actively collect user feedback submitted through our platform. This input is invaluable as it helps us to continually refine our offerings and address user needs more effectively.
      </Typography>
      <Typography paragraph>
        <strong>Image Uploads:</strong> We collect and securely store images that you upload during interactions with our ChatBot. These images help us better understand your inquiries related to SolidCAM software and provide more accurate assistance.
      </Typography>

      <Typography variant="h6" component="h3" gutterBottom>Use of Information</Typography>
      <Typography paragraph>
        <strong>Service Improvement:</strong> The primary use of collected data is to enhance the functionality and effectiveness of the ChatBot. By analyzing questions and responses, we are able to continually train our model to better serve your needs.
      </Typography>
      <Typography paragraph>
        <strong>Communication:</strong> We may use your email address to contact you with updates about our service, respond to inquiries, or provide assistance with any issues related to SolidCAM.
      </Typography>

      <Typography variant="h6" component="h3" gutterBottom>Data Retention and Deletion</Typography>
      <Typography paragraph>
        <strong>Data Categories and Retention:</strong> We maintain the following categories of data:
      </Typography>
      <Box component="ul" sx={{ pl: 2 }}>
        <li>
          <strong>Chat History:</strong> This includes your conversation logs with the ChatBot. You can delete your chat history at any time through the Settings page for specific timeframes (last hour, day, week, month, or all). Deleting chat history does not affect our Questions and Answers database.
        </li>
        <li>
          <strong>Questions and Answers Database:</strong> We maintain a database of questions and corresponding answers to improve our service. This data is kept for a minimum of 1 month and is subject to your data retention preferences set in your account settings.
        </li>
        <li>
          <strong>Uploaded Images:</strong> All images uploaded during your interactions with the ChatBot are securely stored and automatically deleted after 30 days. This applies regardless of your other data retention settings.
        </li>
      </Box>
      <Typography paragraph>
        <strong>Retention Periods:</strong> By default, we retain your data for 1 month. Through your account settings under "Data Retention," you can choose to extend this period to 3 months, 6 months, 1 year, or forever. When this retention period expires, personal data is anonymized in our knowledge base while preserving the value of Q&A pairs for service improvement. Note that uploaded images are always deleted after 30 days regardless of these settings.
      </Typography>
      <Typography paragraph>
        <strong>Complete Data Deletion:</strong> If you wish to request complete deletion of all your data, including anonymized Q&A pairs and any uploaded images, please email <a href="mailto:ai@solidcam.app">ai@solidcam.app</a> with your account email address. We will process your request within 30 days as required by applicable regulations.
      </Typography>
      <Typography paragraph>
        <strong>Account Deletion:</strong> When you choose to delete your account through the Settings page, we:
      </Typography>
      <Box component="ul" sx={{ pl: 2 }}>
        <li>Delete all your chat history</li>
        <li>Anonymize your questions and answers in our database by replacing personal identifiers with randomized tokens</li>
        <li>Remove all privacy settings and associated personal information</li>
        <li>Delete your user account from our authentication system</li>
        <li>Your uploaded images will continue to be stored securely and will be automatically deleted after the standard 30-day retention period</li>
      </Box>

      <Typography variant="h6" component="h3" gutterBottom>Data Sharing and Third-Party Disclosure</Typography>
      <Typography paragraph>
        <strong>No Third-Party Sharing:</strong> We steadfastly refuse to sell or share your personal data with third-party marketers.
      </Typography>
      <Typography paragraph>
        <strong>OpenAI Partnership:</strong> Inputs and outputs related to the ChatBot are temporarily stored by OpenAI for a period of 30 days as part of our ongoing efforts to enhance the service, as detailed <a href="#">here</a>.
      </Typography>
      <Typography paragraph>
        <strong>Compliance and Legal Disclosures:</strong> While we do not share your personal information with third parties, we may disclose information if legally required to do so or if necessary to protect our rights or the rights of others.
      </Typography>

      <Typography variant="h6" component="h3" gutterBottom>Legal Basis for Processing (GDPR)</Typography>
      <Typography paragraph>
        We process your personal data on the following legal grounds:
      </Typography>
      <Box component="ul" sx={{ pl: 2 }}>
        <li>
          <strong>Contract:</strong> Processing is necessary for the performance of our contract to provide you with the ChatBot service.
        </li>
        <li>
          <strong>Legitimate Interests:</strong> We process certain data based on our legitimate interests in improving our service, ensuring its security, and addressing user needs. This includes the retention of anonymized Q&A pairs.
        </li>
        <li>
          <strong>Consent:</strong> Where required by law, we process data based on your consent, which you can withdraw at any time.
        </li>
        <li>
          <strong>Legal Obligation:</strong> We may process your data to comply with legal obligations applicable to us.
        </li>
      </Box>

      <Typography variant="h6" component="h3" gutterBottom>User Rights Under GDPR</Typography>
      <Typography paragraph>
        If you are located in the European Economic Area (EEA), you have the following rights regarding your personal data:
      </Typography>
      <Box component="ul" sx={{ pl: 2 }}>
        <li>
          <strong>Right to Access:</strong> You can access your personal data through the Settings page or by contacting us.
        </li>
        <li>
          <strong>Right to Rectification:</strong> You can correct inaccurate personal data.
        </li>
        <li>
          <strong>Right to Erasure:</strong> You can delete your data as described in our Data Retention and Deletion section.
        </li>
        <li>
          <strong>Right to Restrict Processing:</strong> You can request restriction of processing of your personal data.
        </li>
        <li>
          <strong>Right to Data Portability:</strong> You can request a copy of your data in a structured, commonly used, and machine-readable format.
        </li>
        <li>
          <strong>Right to Object:</strong> You can object to processing based on legitimate interests.
        </li>
        <li>
          <strong>Rights Related to Automated Decision Making:</strong> You have rights related to automated decision-making, including profiling.
        </li>
      </Box>
      <Typography paragraph>
        To exercise these rights, please email <a href="mailto:ai@solidcam.app">ai@solidcam.app</a> or use the relevant features in your account settings.
      </Typography>

      <Typography variant="h6" component="h3" gutterBottom>Data Security</Typography>
      <Typography paragraph>
        <strong>Protective Measures:</strong> We employ robust technical, administrative, and organizational controls to safeguard your personal data against unauthorized access, loss, or modification. Measures include encryption, access control procedures, and secure software development practices.
      </Typography>
      <Typography paragraph>
        <strong>Image Storage Security:</strong> All uploaded images are stored using industry-standard encryption and secure storage methods to ensure your data remains protected during the retention period.
      </Typography>
      <Typography paragraph>
        <strong>Data Breach Notification:</strong> In the event of a data breach that may affect your personal information, we will notify you and relevant authorities as required by applicable law without undue delay.
      </Typography>

      <Typography variant="h6" component="h3" gutterBottom>International Data Transfers</Typography>
      <Typography paragraph>
        <strong>Cross-Border Data Transfers:</strong> Information that we collect may be stored and processed in and transferred between any of the countries in which we operate to enable us to use the information in accordance with this policy. Where data is transferred outside the EEA, we ensure appropriate safeguards are in place, such as Standard Contractual Clauses or adequacy decisions.
      </Typography>

      <Typography variant="h6" component="h3" gutterBottom>Cookies and Similar Technologies</Typography>
      <Typography paragraph>
        <strong>Use of Cookies:</strong> We use cookies and similar technologies to provide, customize, and improve our services. You can control cookies through your browser settings. For more information, please see our Cookie Policy.
      </Typography>

      <Typography variant="h6" component="h3" gutterBottom>Children's Privacy</Typography>
      <Typography paragraph>
        Our service is not directed at individuals under the age of 16. If we become aware that we have collected personal data from a child under 16 without parental consent, we will take steps to delete that information.
      </Typography>

      <Typography variant="h6" component="h3" gutterBottom>Changes to This Privacy Policy</Typography>
      <Typography paragraph>
        <strong>Updates and Modifications:</strong> We may update this policy periodically to reflect changes in our practices or relevant regulations. We will notify you of significant changes by posting the new privacy policy on our website and, where appropriate, via email.
      </Typography>

      <Typography variant="h6" component="h3" gutterBottom>Contact Information and Complaints</Typography>
      <Typography paragraph>
        For any questions or concerns regarding our privacy practices, please contact us at <a href="mailto:ai@solidcam.app">ai@solidcam.app</a> or via our designated support channels.
      </Typography>
      <Typography paragraph>
        If you are located in the EEA and believe that we have not adequately addressed your data privacy concerns, you have the right to lodge a complaint with your local supervisory authority.
      </Typography>
      </Box>
    </Container>
  );
}