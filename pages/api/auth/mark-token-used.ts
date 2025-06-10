import { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '../../../utils/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Mark token as used in Firestore
    await adminDb.collection('passwordResetTokens').doc(token).update({
      used: true,
      usedAt: new Date()
    });

    console.log('✅ Token marked as used:', token.substring(0, 10) + '...');

    return res.status(200).json({
      success: true,
      message: 'Token marked as used'
    });

  } catch (error: any) {
    console.error('❌ Error marking token as used:', error);
    return res.status(500).json({ error: 'Failed to mark token as used' });
  }
}
