// pages/api/upload.ts
import { Storage } from '@google-cloud/storage';
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';

// Initialize Storage with Firebase service account credentials
const storage = new Storage({
  projectId: process.env.FIREBASE_PROJECT_ID,
  keyFilename: undefined, // We'll use credentials object instead
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const publicBucket = process.env.GCLOUD_STORAGE_BUCKET || 'chatbot-documents';
const privateBucket = process.env.GCLOUD_PRIVATE_STORAGE_BUCKET || 'chatbot-private-images';

export const config = {
  api: {
    bodyParser: false,
  },
};

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

async function generateSignedUrl(file: any, userEmail: string): Promise<string> {
  const options = {
    version: 'v4',
    action: 'read',
    expires: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
  };

  const [signedUrl] = await file.getSignedUrl(options);
  return signedUrl;
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const userEmail = req.headers.authorization;
  // Check if this is a private upload (from useFileUploadFromHome)
  const isPrivateUpload = req.headers['x-upload-type'] === 'private';
  
  if (isPrivateUpload && !userEmail) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const form = formidable({ multiples: true, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error parsing the form: ', err);
      return res.status(500).json({ error: 'Error parsing the files' });
    }

    if (!files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileArray = Array.isArray(files.file) ? files.file : [files.file];

    if (fileArray.length > 2) {
      return res.status(400).json({ error: 'Only 2 images are allowed per upload' });
    }

    const invalidFiles = fileArray.filter(file => !file.mimetype || !allowedMimeTypes.includes(file.mimetype));
    if (invalidFiles.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid file type(s) detected', 
        details: `Only JPEG, PNG, GIF, and WebP images are allowed.`
      });
    }

    const header = Array.isArray(fields.header) ? fields.header[0] : fields.header;
    const sanitizedHeader = (header || 'default').replace(/[^a-z0-9]/gi, '_').toLowerCase();

    try {
      const bucket = storage.bucket(isPrivateUpload ? privateBucket : publicBucket);
      
      const uploadPromises = fileArray.map(async (file, index) => {
        if (!file) {
          throw new Error('File is undefined');
        }

        const filePath = file.filepath;
        const fileExtension = file.originalFilename ? file.originalFilename.split('.').pop() : 'jpg';
        const safeFileExtension = fileExtension ? fileExtension.toLowerCase() : 'jpg';
        
        // For private uploads, include user email in path
        const fileName = isPrivateUpload 
          ? `${userEmail}/${sanitizedHeader}_${Date.now()}_${index}.${safeFileExtension}`
          : `${sanitizedHeader}_${Date.now()}_${index}.${safeFileExtension}`;

        const blob = bucket.file(fileName);
        
        // Set metadata for private uploads
        const metadata = {
          contentType: file.mimetype || 'application/octet-stream',
          metadata: isPrivateUpload ? {
            userEmail,
            uploadDate: new Date().toISOString(),
            expirationDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString()
          } : undefined
        };

        const blobStream = blob.createWriteStream({
          resumable: false,
          gzip: true,
          metadata
        });

        await new Promise((resolve, reject) => {
          blobStream.on('error', reject);
          blobStream.on('finish', resolve);
          fs.createReadStream(filePath).pipe(blobStream);
        });

        let url: string;
        if (isPrivateUpload && userEmail) {
          // Generate signed URL for private uploads
          url = await generateSignedUrl(blob, userEmail);
        } else {
          // Make file public and use public URL
          await blob.makePublic();
          url = `https://storage.googleapis.com/${publicBucket}/${blob.name}`;
        }

        return { 
          url,
          fileName,
          uploadDate: isPrivateUpload ? metadata.metadata?.uploadDate : undefined,
          expirationDate: isPrivateUpload ? metadata.metadata?.expirationDate : undefined
        };
      });

      const uploadResults = await Promise.all(uploadPromises);
      return res.status(200).json({ imageUrls: uploadResults });
    } catch (error: any) {
      console.error('Error uploading image: ', error);
      return res.status(500).json({ error: 'Failed to upload image', details: error.message });
    }
  });
};

export default handler;