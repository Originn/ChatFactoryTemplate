// pages/api/generate-signed-url.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import chatbotBucketService from '@/services/chatbotBucketService';

interface SignedUrlRequest {
  url: string;
  page?: string;
}

interface SignedUrlResponse {
  signedUrl: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SignedUrlResponse>
) {
  if (req.method !== 'POST') {
    res.status(405).json({ signedUrl: '', error: `Method ${req.method} not allowed` });
    return;
  }

  const { url, page }: SignedUrlRequest = req.body;

  if (!url) {
    res.status(400).json({ signedUrl: '', error: 'URL is required' });
    return;
  }

  try {
    // Extract bucket name and file path from the storage URL
    let bucketName: string;
    let fileName: string;

    if (url.includes('storage.googleapis.com')) {
      // Format: https://storage.googleapis.com/bucket-name/path/to/file.pdf
      const urlParts = url.replace('https://storage.googleapis.com/', '').split('/');
      bucketName = urlParts[0];
      fileName = urlParts.slice(1).join('/');
    } else if (url.startsWith('gs://')) {
      // Format: gs://bucket-name/path/to/file.pdf
      const urlParts = url.replace('gs://', '').split('/');
      bucketName = urlParts[0];
      fileName = urlParts.slice(1).join('/');
    } else {
      // If it's already a signed URL or external URL, return as-is
      const finalUrl = page ? `${url}#page=${page}` : url;
      res.status(200).json({ signedUrl: finalUrl });
      return;
    }

    if (!fileName) {
      res.status(400).json({ signedUrl: '', error: 'Could not extract filename from URL' });
      return;
    }

    // Determine bucket type based on bucket name
    let bucketType: 'documents' | 'privateImages' | 'documentImages';
    
    if (bucketName.includes('document-images')) {
      bucketType = 'documentImages';
    } else if (bucketName.includes('private')) {
      bucketType = 'privateImages';
    } else {
      bucketType = 'documents';
    }

    // Generate signed URL with 24-hour expiration
    const signedUrl = await chatbotBucketService.getSignedUrl(
      bucketType,
      fileName,
      {
        action: 'read',
        expires: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      }
    );

    // Add page fragment if provided
    const finalUrl = page ? `${signedUrl}#page=${page}` : signedUrl;

    res.status(200).json({ signedUrl: finalUrl });
  } catch (error: any) {
    console.error('Error generating signed URL:', error);
    res.status(500).json({ 
      signedUrl: '', 
      error: `Failed to generate signed URL: ${error.message}` 
    });
  }
}