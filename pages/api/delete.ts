// pages/api/delete.ts
import { Storage } from '@google-cloud/storage';
import { NextApiRequest, NextApiResponse } from 'next';

const storage = new Storage();
const bucketName = process.env.GCLOUD_STORAGE_BUCKET || 'solidcam';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fileName } = req.body;

  if (!fileName) {
    return res.status(400).json({ error: 'No fileName provided' });
  }

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    await file.delete();
    return res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file from GCP:', error);
    return res.status(500).json({ error: 'Failed to delete file from GCP' });
  }
}
