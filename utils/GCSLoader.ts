//GCSLoader.ts

import { Storage, GetSignedUrlConfig } from '@google-cloud/storage';
//import { default as pdfParse } from 'pdf-parse/lib/pdf-parse.js';
import { waitForUserInput, extractYouTubeLink, extractSentinalLink } from 'utils/textsplitter';
import { spawn } from 'child_process';
import * as tmp from 'tmp-promise';
import fs from 'fs';
import path from 'path';

export interface DocumentInput<Metadata extends { videoLink?: string; score?: number; file?: string; uploadDate?: Date } = Record<string, any>> {
    pageNumber?: number;
    pageHeader?: string;
    pageContent: string;
    metadata?: Metadata;
}

export class MyDocument<Metadata extends { videoLink?: string; score?: number; file?: string; uploadDate?: Date } = Record<string, any>> implements DocumentInput<Metadata> {
    pageNumber?: number;
    pageHeader?: string;
    pageContent: string;
    metadata: Metadata;

    constructor(fields: DocumentInput<Metadata>) {
        this.pageNumber = fields.pageNumber;
        this.pageHeader = fields.pageHeader;
        this.pageContent = fields.pageContent;
        // Ensure metadata is initialized properly
        this.metadata = fields.metadata || {} as Metadata;
        // If score is provided, add it to metadata
        if (fields.metadata?.score !== undefined) {
            this.metadata.score = fields.metadata.score;
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
        const items = fs.readdirSync(localDirectoryPath, { withFileTypes: true });
    
        const documents: MyDocument[] = [];
    
        for (const item of items) {
            if (item.isDirectory()) {
                const folderName = item.name;
                const folderPath = path.join(localDirectoryPath, folderName);
                const fileNames = fs.readdirSync(folderPath);
    
                for (const fileName of fileNames) {
                    const filePath = path.join(folderPath, fileName);
                    if (!fileName.endsWith('.pdf') && !fileName.endsWith('.txt') && !fileName.endsWith('vbs') && !fileName.endsWith('python')) {
                        continue;
                    }
    
                    let contentString: string;
                    if (fileName.endsWith('.pdf') || fileName.endsWith('.txt') || fileName.endsWith('vbs') || fileName.endsWith('python')) {
                        contentString = await this.parse(filePath);
                    } else {
                        console.log(`Unsupported file type for ${fileName}`);
                        continue;
                    }
                    
                    let headerMatch, headerContentMatch;

                    if (/\"header\":\s*\"[^\"]*\|/.test(contentString)) {
                        // If "header" contains a "|", use this pattern
                        headerMatch = contentString.match(/"header":\s*"([^"]*?)\s*\|/);
                    } else {
                        // If "header" does not contain a "|", use this pattern
                        headerContentMatch = contentString.match(/"header":\s*"([^"]*?)"/);
                    }

                    // Use the entire header content if headerMatch is not found
                    const file = headerMatch ? headerMatch[1] : (headerContentMatch ? headerContentMatch[1] : "null");
                    let DocCloudUrl;
                    let existingYouTubeSource = extractYouTubeLink(contentString);
                    let existingSentinalSource = extractSentinalLink(contentString);
                    if (!existingYouTubeSource && !existingSentinalSource) { // If there's no YouTube link, use the GCS link
                        DocCloudUrl = this.generatePublicUrl(fileName);
                    }
    
                    //console.log('contentString:', contentString);
                    //await waitForUserInput();
                    const contentData = JSON.parse(contentString);
                    //await waitForUserInput();
    
                    // Temporary dictionary to group content by header
                    const groupedContent: Record<string, { contents: string[], source: string, file: string, uploadDate?: Date }> = {};
    
                    for (let pageInfoGroup of contentData) {
                        for (let content of pageInfoGroup.contents) {
                            const pageNumber = content.page_number;
                            const pageContent = content.PageContent + ` (${pageNumber})`; // append page number
                    
                            if (pageInfoGroup.header in groupedContent) {
                                groupedContent[pageInfoGroup.header].contents.push(pageContent);
                            } else {
                                let cleanedFile = file.replace(/\*+/g, '').replace(/^\s+|\s+$/g, '');
                                groupedContent[pageInfoGroup.header] = {
                                    contents: [pageContent],
                                    source: existingYouTubeSource || existingSentinalSource || DocCloudUrl || "",
                                    file: cleanedFile
                                };
                            }
                        }
                    }
                    
    
                    // Flatten the grouped content into the documents array
                    for (let [header, data] of Object.entries(groupedContent)) {
                        const concatenatedContent = data.contents.join(' '); // Concatenate all content for this header
                        let metadata; // Declare metadata variable

                        // Check if the header contains "General_FAQ"
                        if (header.includes('General_FAQ')) {
                            // If so, set videoLink, source, and uploadDate to null
                            metadata = {
                                source: null,
                                videoLink: null,
                                uploadDate: null,
                                file: data.file
                            };
                        } else {
                            // Otherwise, proceed as normal
                            metadata = {
                                source: data.source,
                                videoLink: data.source.includes('youtube') ? data.source : null,
                                uploadDate: data.source.includes('youtube') ? data.uploadDate : null,
                                file: data.file
                            };
                        }

                        documents.push({
                            pageHeader: header,
                            pageContent: concatenatedContent,
                            metadata: metadata,
                        });
                    }

                }
            }
        }
        return documents;
    }
}

export default GCSLoader;
    