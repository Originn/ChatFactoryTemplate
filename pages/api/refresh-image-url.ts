import { NextApiRequest, NextApiResponse } from 'next';
import chatbotBucketService from '../../services/chatbotBucketService';

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
    // Sanitize user email for folder structure
    const sanitizedUserEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const fullFilePath = fileName.includes('/') ? fileName : `${sanitizedUserEmail}/${fileName}`;
    
    // Verify file ownership - ensure user can only access their own files
    if (!fullFilePath.startsWith(sanitizedUserEmail + '/')) {
      return res.status(403).json({ error: 'Access denied: You can only access your own files' });
    }

    // Check if file exists first
    const fileExists = await chatbotBucketService.fileExists('privateImages', fullFilePath);
    if (!fileExists) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file metadata to verify ownership
    try {
      const metadata = await chatbotBucketService.getFileMetadata('privateImages', fullFilePath);
      
      // Additional security check: verify metadata matches user
      if (metadata.metadata?.userEmail && metadata.metadata.userEmail !== userEmail) {
        return res.status(403).json({ error: 'Access denied: File belongs to different user' });
      }
    } catch (metadataError) {
      // Continue anyway - file existence check passed
    }

    // Generate new signed URL with extended expiration
    const signedUrl = await chatbotBucketService.getSignedUrl(
      'privateImages',
      fullFilePath,
      {
        action: 'read',
        expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
      }
    );

    return res.status(200).json({
      success: true,
      signedUrl,
      fileName,
      fullPath: fullFilePath,
      expiresIn: '7 days',
      refreshedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error refreshing image URL:', error);

    // Handle specific error types
    if (error.code === 403) {
      return res.status(403).json({
        error: 'Access denied to file',
        message: 'Service account may not have proper bucket permissions'
      });
    }

    if (error.message?.includes('does not exist')) {
      return res.status(404).json({
        error: 'File not found',
        fileName
      });
    }

    return res.status(500).json({
      error: 'Failed to refresh image URL',
      message: error.message
    });
  }
}