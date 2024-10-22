import { Storage } from '@google-cloud/storage';
import { NextApiRequest, NextApiResponse } from 'next';

// Define both public and private buckets
const storage = new Storage();
const publicBucketName = process.env.GCLOUD_STORAGE_BUCKET || 'solidcam-chatbot-documents';
const privateBucketName = process.env.GCLOUD_PRIVATE_STORAGE_BUCKET || 'solidcam-chatbot-private-images';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fileName, isPrivate } = req.body; // Include `isPrivate` to determine bucket
  console.log('isPrivate:', isPrivate);

  if (!fileName) {
    return res.status(400).json({ error: 'No fileName provided' });
  }

  try {
    // Select the correct bucket based on whether the file is private or public
    const bucketName = isPrivate ? privateBucketName : publicBucketName;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    console.log('Deleting file from GCP:', fileName);

    await file.delete();
    return res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file from GCP:', error);
    return res.status(500).json({ error: 'Failed to delete file from GCP' });
  }
}
