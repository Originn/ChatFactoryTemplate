// pages/api/upload.ts
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import chatbotBucketService from '../../services/chatbotBucketService';

export const config = {
  api: {
    bodyParser: false,
  },
};

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const userEmail = req.headers.authorization;
  // Check if this is a private upload (from useFileUploadFromHome)
  const isPrivateUpload = req.headers['x-upload-type'] === 'private';
  
  if (isPrivateUpload && !userEmail) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const form = formidable({ multiples: true, keepExtensions: true });

  // Wrap form.parse in a Promise to handle async properly
  return new Promise<void>((resolve, reject) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('❌ Form parsing error:', err);
        res.status(500).json({ error: 'File parsing failed' });
        return resolve();
      }

      try {
        const uploadedFiles = Array.isArray(files.file) ? files.file : [files.file].filter(Boolean);
        
        if (!uploadedFiles.length) {
          res.status(400).json({ error: 'No files uploaded' });
          return resolve();
        }

        const results = [];

        for (const file of uploadedFiles) {
          if (!file) continue;

          // Validate file type
          if (!allowedMimeTypes.includes(file.mimetype || '')) {
            console.warn(`⚠️ Invalid file type: ${file.mimetype}`);
            results.push({
              filename: file.originalFilename,
              error: 'Invalid file type. Only images are allowed.'
            });
            continue;
          }

          try {
            // Read file buffer
            const fileBuffer = fs.readFileSync(file.filepath);
            const fileName = `${Date.now()}-${file.originalFilename}`;
            
            let uploadResult;
            let signedUrl;

            if (isPrivateUpload && userEmail) {
              // Upload to private images bucket
              const userId = userEmail.replace(/[^a-zA-Z0-9]/g, '_'); // Sanitize email for folder name
              uploadResult = await chatbotBucketService.uploadPrivateImage(
                userId, 
                fileName, 
                fileBuffer,
                { 
                  contentType: file.mimetype,
                  originalName: file.originalFilename
                }
              );
              
              // Generate signed URL for private access
              signedUrl = await chatbotBucketService.getSignedUrl(
                'privateImages',
                `${userId}/${fileName}`,
                { expires: Date.now() + (7 * 24 * 60 * 60 * 1000) } // 7 days
              );
              
            } else {
              // Upload to public document images bucket
              uploadResult = await chatbotBucketService.uploadDocumentImage(
                fileName,
                fileBuffer,
                { 
                  contentType: file.mimetype,
                  originalName: file.originalFilename
                }
              );
              
              // For public images, use direct public URL
              signedUrl = chatbotBucketService.getPublicDocumentImageUrl(fileName);
            }

            // Clean up temp file
            fs.unlinkSync(file.filepath);

            results.push({
              filename: fileName,
              originalName: file.originalFilename,
              url: signedUrl,
              gsUrl: uploadResult,
              contentType: file.mimetype,
              size: fileBuffer.length,
              isPrivate: isPrivateUpload,
              success: true
            });

          } catch (uploadError: any) {
            console.error(`❌ Upload error for ${file.originalFilename}:`, uploadError);
            
            // Clean up temp file even on error
            try {
              fs.unlinkSync(file.filepath);
            } catch (cleanupError) {
              console.warn('⚠️ Failed to clean up temp file:', cleanupError);
            }

            results.push({
              filename: file.originalFilename,
              error: uploadError.message || 'Upload failed',
              success: false
            });
          }
        }

        // Return results in the format expected by frontend
        const successCount = results.filter(r => r.success).length;
        const errorCount = results.filter(r => !r.success).length;

        // Frontend expects 'imageUrls' format
        const imageUrls = results
          .filter(r => r.success)
          .map(file => ({
            url: file.url,
            fileName: file.filename
          }));

        res.status(200).json({
          success: errorCount === 0,
          imageUrls: imageUrls,
          files: results,
          summary: {
            total: results.length,
            success: successCount,
            errors: errorCount
          }
        });
        
        resolve();

      } catch (error: any) {
        console.error('❌ Upload handler error:', error);
        res.status(500).json({ 
          error: 'Upload processing failed',
          message: error.message 
        });
        resolve();
      }
    });
  });
};

export default handler;