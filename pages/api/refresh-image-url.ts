import { NextApiRequest, NextApiResponse } from 'next';
import { Storage, GetSignedUrlConfig } from '@google-cloud/storage';

const storage = new Storage();
const privateBucketName = process.env.GCLOUD_PRIVATE_STORAGE_BUCKET || 'chatbot-private-images';

// Define the metadata interface
interface FileMetadata {
  metadata?: {
    userEmail?: string;
    expirationDate?: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userEmail = req.headers.authorization;
  if (!userEmail) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { fileName } = req.body;
  if (!fileName) {
    return res.status(400).json({ error: 'No fileName provided' });
  }

  try {
    const bucket = storage.bucket(privateBucketName);
    const file = bucket.file(fileName);
    
    // Type assertion to ensure metadata has the correct shape
    const [metadata] = await file.getMetadata() as [FileMetadata, unknown];
    
    // Check if metadata exists and has required fields
    if (!metadata?.metadata?.userEmail) {
      return res.status(400).json({ error: 'File metadata is missing' });
    }

    if (metadata.metadata.userEmail !== userEmail) {
      return res.status(403).json({ error: 'Unauthorized access to file' });
    }

    // Check for expiration date
    const expirationDateStr = metadata.metadata.expirationDate;
    if (!expirationDateStr) {
      return res.status(400).json({ error: 'Missing expiration date' });
    }

    const expirationDate = new Date(expirationDateStr);
    // Check if the date is valid
    if (isNaN(expirationDate.getTime())) {
      return res.status(400).json({ error: 'Invalid expiration date format' });
    }

    if (expirationDate < new Date()) {
      return res.status(410).json({ error: 'Image has expired' });
    }

    // Generate new 7-day signed URL
    const options: GetSignedUrlConfig = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
    };

    const [signedUrl] = await file.getSignedUrl(options);
    return res.status(200).json({ url: signedUrl });
  } catch (error) {
    console.error('Error refreshing signed URL:', error);
    return res.status(500).json({ error: 'Failed to refresh image URL' });
  }
}