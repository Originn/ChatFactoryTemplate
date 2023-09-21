import { Storage, GetSignedUrlConfig } from '@google-cloud/storage';
import { default as pdfParse } from 'pdf-parse/lib/pdf-parse.js';
import { extractYouTubeLink } from 'scripts/ingest-data';

interface Document {
    pageContent: string;
    metadata: Record<string, any>;
}

class GCSLoader {
    private storage: Storage;
    private bucketName: string;

    constructor(bucketName: string) {
        this.storage = new Storage();
        this.bucketName = bucketName;
    }

    generatePublicUrl(fileName: string): string {
        return `https://storage.googleapis.com/${this.bucketName}/${fileName}`;
    }

    async generateSignedUrl(fileName: string): Promise<string> {
        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(fileName);
        
        const options: GetSignedUrlConfig = {
            version: 'v4',
            action: 'read' as const,
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // Seven days from now
        };
        
        const urls = await file.getSignedUrl(options) as string[];
        return urls[0];
    }

    async parsePDF(buffer: Buffer): Promise<string> {
        const parsed = await pdfParse(buffer);
        return parsed.text;
    }

    async load(): Promise<Document[]> {
        const bucket = this.storage.bucket(this.bucketName);
        const files = await bucket.getFiles();
    
        const documents: Document[] = [];
    
        for (const file of files[0]) {
            const contents = await file.download();
            const buffer = contents[0];
                
            let contentString;
            if (file.name.endsWith('.pdf')) {
                contentString = await this.parsePDF(buffer);
            } else {
                contentString = buffer.toString('utf-8');
            }

            let existingSource = extractYouTubeLink(contentString);
            if (!existingSource) { // If there's no YouTube link, use the GCS link
                existingSource = this.generatePublicUrl(file.name);
            }
        
            documents.push({
                pageContent: contentString,
                metadata: {
                    source: existingSource,
                },
            });
        }            
    
        return documents;
    } 
}

export default GCSLoader;

