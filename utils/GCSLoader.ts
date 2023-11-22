//GCSLoader.ts

import { Storage, GetSignedUrlConfig } from '@google-cloud/storage';
//import { default as pdfParse } from 'pdf-parse/lib/pdf-parse.js';
import { waitForUserInput, extractYouTubeLink } from 'utils/textsplitter';
import { spawn } from 'child_process';
import * as tmp from 'tmp-promise';
import fs from 'fs';
import path from 'path';

export interface DocumentInput<Metadata extends Record<string, any> = Record<string, any>> {
    pageNumber?: number;
    pageHeader?: string;
    pageContent: string;
    metadata?: Metadata;
}

export class MyDocument<Metadata extends Record<string, any> = Record<string, any>> implements DocumentInput<Metadata> {
    pageNumber?: number;
    pageHeader?: string;
    pageContent: string;
    metadata: Metadata;
    score?: number;

    constructor(fields: DocumentInput<Metadata>) {
        if ('pageNumber' in fields) {
            this.pageNumber = fields.pageNumber;
        }
        if ('pageHeader' in fields) {
            this.pageHeader = fields.pageHeader;
        }
        this.pageContent = fields.pageContent;
        this.metadata = fields.metadata || {} as Metadata;
        if ('score' in fields) {
            this.score = fields['score'] as number | undefined;
        }
    }
}

class GCSLoader {
    private storage: Storage;
    private bucketName: string;

    constructor(bucketName: string) {
        this.storage = new Storage();
        this.bucketName = "solidcam";
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

    private callPythonScript(pdfPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            let output = "";
    
            const pythonProcess = spawn('python', ['utils\\plumber.py', pdfPath]);
            
            pythonProcess.stdout.on('data', (data) => {
                output += data;
            });
            
            pythonProcess.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
            });
            
            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python process exited with code ${code}`));
                } else {
                    resolve(output);
                }
            });
        });
    }

    async parse(filePath: string): Promise<string> {
        // Call the Python script and capture the result
        const content = await this.callPythonScript(filePath);
        return content;
    }

    async load(): Promise<MyDocument[]> {
        const localDirectoryPath = "C:\\Users\\ori.somekh\\Desktop\\SolidcamChat_uploads";
        const fileNames = fs.readdirSync(localDirectoryPath);
    
        const documents: MyDocument[] = [];
    
        for (const fileName of fileNames) {
            const filePath = path.join(localDirectoryPath, fileName);
    
            if (!fileName.endsWith('.pdf') && !fileName.endsWith('.txt')) {
                console.log(`Skipping unsupported file: ${fileName}`);
                continue;
            }
    
            let contentString: string;
            if (fileName.endsWith('.pdf')) {
                contentString = await this.parse(filePath);
            } else if (fileName.endsWith('.txt')) {
                contentString = await this.parse(filePath);
            } else {
                console.log(`Unsupported file type for ${fileName}`);
                continue;
            }
    
            let existingSource = extractYouTubeLink(contentString);
            if (!existingSource) { // If there's no YouTube link, use the GCS link
                existingSource = this.generatePublicUrl(fileName);
            }

            console.log('contentString:', contentString)
            const contentData = JSON.parse(contentString);
            //await waitForUserInput();
            
    
            // Temporary dictionary to group content by header
            const groupedContent: Record<string, { contents: string[], source: string }> = {};

            for (let pageInfoGroup of contentData) {
                for (let content of pageInfoGroup.contents) {
                    const pageNumber = content.page_number;
                    const pageContent = content.PageContent + ` (${pageNumber})`; // append page number

                    if (pageInfoGroup.header in groupedContent) {
                        groupedContent[pageInfoGroup.header].contents.push(pageContent);
                    } else {
                        groupedContent[pageInfoGroup.header] = {
                            contents: [pageContent],
                            source: existingSource
                        };
                    }
                }
            }

            // Flatten the grouped content into the documents array
            for (let [header, data] of Object.entries(groupedContent)) {
                const concatenatedContent = data.contents.join(' '); // Concatenate all content for this header
                documents.push({
                    pageHeader: header,
                    pageContent: concatenatedContent,
                    metadata: {
                        source: data.source,
                    },
                });
            }
        }
    return documents;
    }
}

export default GCSLoader;

