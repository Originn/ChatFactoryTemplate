import { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '../../../utils/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, chatbotId } = req.body;

    if (!token || !chatbotId) {
      return res.status(400).json({ error: 'Token and chatbot ID are required' });
    }

    console.log('🔧 Validating custom token:', token.substring(0, 10) + '...');

    // Get token data from Firestore
    const tokenDoc = await adminDb
      .collection('passwordResetTokens')
      .doc(token)
      .get();

    if (!tokenDoc.exists) {
      return res.status(400).json({ error: 'Invalid or expired setup link' });
    }

    const tokenData = tokenDoc.data();

    // Verify token is valid
    if (tokenData?.used) {
      return res.status(400).json({ error: 'This setup link has already been used' });
    }

    if (tokenData?.expiresAt?.toDate() < new Date()) {
      return res.status(400).json({ error: 'This setup link has expired' });
    }

    // Verify chatbot ID matches
    if (tokenData?.chatbotId !== chatbotId) {
      return res.status(400).json({ error: 'Invalid setup link for this chatbot' });
    }

    console.log('✅ Token validation successful');

    return res.status(200).json({
      success: true,
      email: tokenData?.email,
      userId: tokenData?.userId
    });

  } catch (error: any) {
    console.error('❌ Token validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
