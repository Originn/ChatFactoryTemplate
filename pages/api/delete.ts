import { NextApiRequest, NextApiResponse } from 'next';
import chatbotBucketService from '../../services/chatbotBucketService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fileName, isPrivate } = req.body;
  const userEmail = req.headers.authorization;

  if (!fileName) {
    return res.status(400).json({ error: 'No fileName provided' });
  }

  // For private files, require user authentication
  if (isPrivate && !userEmail) {
    return res.status(401).json({ error: 'Authentication required for private file deletion' });
  }

  try {
    let fileToDelete = fileName;
    let bucketType: 'documents' | 'privateImages' | 'documentImages';
    
    // Determine bucket type and construct file path
    if (isPrivate) {
      bucketType = 'privateImages';
      
      if (userEmail) {
        const userId = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
        // Check if fileName already includes the user folder
        fileToDelete = fileName.includes('/') ? fileName : `${userId}/${fileName}`;
        
        // Security check: ensure user can only delete their own files
        if (!fileToDelete.startsWith(`${userId}/`)) {
          return res.status(403).json({ error: 'Access denied: You can only delete your own files' });
        }
      }
    } else {
      // For public files, determine if it's documents or document images
      bucketType = 'documentImages'; // Assuming document images for now
    }

    console.log(`🗑️ Deleting file: ${fileToDelete} from bucket type: ${bucketType}`);
    await chatbotBucketService.deleteFile(bucketType, fileToDelete);
    
    return res.status(200).json({ 
      message: 'File deleted successfully',
      fileName: fileToDelete,
      bucketType: bucketType
    });
  } catch (error) {
    console.error('Error deleting file from GCP:', error);
    return res.status(500).json({ error: 'Failed to delete file from GCP' });
  }
}
