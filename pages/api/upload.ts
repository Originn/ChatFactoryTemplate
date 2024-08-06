// pages/api/upload.ts
import { Storage } from '@google-cloud/storage';
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';

const storage = new Storage();
const bucketName = process.env.GCLOUD_STORAGE_BUCKET || 'solidcam-chatbot-documents';

export const config = {
  api: {
    bodyParser: false,
  },
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
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

    // Check if more than 2 files are being uploaded
    if (fileArray.length > 2) {
      return res.status(400).json({ error: 'Only 2 images are allowed per upload' });
    }

    const header = Array.isArray(fields.header) ? fields.header[0] : fields.header;
    const sanitizedHeader = (header || 'default').replace(/[^a-z0-9]/gi, '_').toLowerCase();

    try {
      const uploadPromises = fileArray.map(async (file, index) => {
        if (!file) {
          throw new Error('File is undefined');
        }

        const filePath = file.filepath;
        let fileName = `${sanitizedHeader}.jpg`;
        let fileExists = await storage.bucket(bucketName).file(fileName).exists();
        let fileIndex = index;

        while (fileExists[0]) {
          fileName = `${sanitizedHeader}_${fileIndex}.jpg`;
          fileExists = await storage.bucket(bucketName).file(fileName).exists();
          fileIndex++;
        }

        const bucket = storage.bucket(bucketName);
        const blob = bucket.file(fileName);
        const blobStream = blob.createWriteStream({
          resumable: false,
          gzip: true,
        });

        await new Promise((resolve, reject) => {
          blobStream.on('error', reject);
          blobStream.on('finish', resolve);
          fs.createReadStream(filePath).pipe(blobStream);
        });

        await blob.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
        return { url: publicUrl, fileName };
      });

      const uploadResults = await Promise.all(uploadPromises);
      return res.status(200).json({ imageUrls: uploadResults });
    } catch (error) {
      console.error('Error uploading image: ', error);
      return res.status(500).json({ error: 'Failed to upload image' });
    }
  });
};

export default handler;