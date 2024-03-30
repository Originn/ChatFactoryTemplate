//ingest-data.ts
import { CharacterTextSplitter, RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { getPinecone } from '@/utils/pinecone-client';
import GCSLoader from '@/utils/GCSLoader';
import { PINECONE_NAME_SPACE } from '@/config/pinecone';
import { waitForUserInput, extractFirstTimestampInSeconds, extractYouTubeLink, extractSentinalLinkFromMetaDataSource } from '@/utils/textsplitter'

import { get_encoding, encoding_for_model } from 'tiktoken';

let encoding =  get_encoding("cl100k_base")
 encoding = encoding_for_model("gpt-3.5-turbo");

 function determineSourceType(url: string | null): string {
  // Check if url is truthy (not null or undefined) before proceeding
  if (!url) {
      return 'txt'; // Return 'unknown' or another appropriate default value if url is null or undefined
  }

  if (url.includes('youtube')) return 'youtube';
  if (url.includes('sentinel')) return 'sentinel';
  if (url.includes('.pdf')) return 'pdf';
  return 'other';  // Default if neither match
}


function removeDuplicateContent(text: string, compareLength: number = 100): string {
    // Use the first 'compareLength' characters of the text for comparison.
    const comparisonText = text.substring(0, compareLength).trim();
    // Look for the second occurrence of the comparison text.
    const secondOccurrenceIndex = text.indexOf(comparisonText, compareLength);
  
    if (secondOccurrenceIndex === -1) {
      // If the comparison text does not repeat, return the original text.
      return text;
    } else {
      // If a duplicate is found, return the text up to the start of the duplicate.
      return text.substring(0, secondOccurrenceIndex).trim();
    }
  }

  function ensureNewlineBeforeHeaders(content : string) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('**') && i > 0 && lines[i - 1] !== '') {
            lines[i] = '\n' + lines[i];
        }
    }
    return lines.join('\n');
}

function removeDuplicatedSections(content: string, header: string): string {
  // Check if content even starts with the header
  if (!content.startsWith(header)) {
    return content; // Nothing to remove if header isn't present
  }

  // Find the end position of the header (including delimiter)
  const headerEndIndex = header.length + 2; // Account for `\n\n` after header

  // Check if content has additional sections after the header
  if (content.length > headerEndIndex) {
    // Slice the content to remove the first header and delimiter
    return content.slice(headerEndIndex);
  } else {
    // Content only contains the header, return empty string
    return '';
  }
}
  
  async function checkDocumentsTokenLength(processedDocs: any[]): Promise<any[]> {
    let cleanProcessedDocs: any[] = [];
  
    for (const doc of processedDocs) {
      let tokens = encoding.encode(doc.pageContent);
      if (tokens.length > 800){
        console.log('tokens:', tokens.length, 'in file:', doc.metadata.file);
      }
      if (tokens.length > 1000) {
        if (doc.metadata.videoLink){
          const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
            //separators: ["\n**"],
          });
          const headerRegex = /^((?:[^\|]+\|)*)([^\|]+)\s*---/;
          const match = doc.pageContent.match(headerRegex);
          const firstHeaderLine = match ? match[0] : null;

          const header = firstHeaderLine ? firstHeaderLine  + '\n\n' : 'Default Header\n\n---\n\n';
          let cleanedChunks = await splitter.createDocuments([doc.pageContent], [doc.metadata], {
          chunkHeader: header,
          appendChunkOverlapHeader: true,
          });

          cleanedChunks.shift();
          if (cleanedChunks.length > 0) {
            // Extract the timestamp from the first document's pageContent
            const timestampRegex = /\(cont'd\) \((\d+:\d+)\)/;
            const firstDoc = cleanedChunks[0];
            const timestampMatch = firstDoc.pageContent.match(timestampRegex);
            const timestamp = timestampMatch ? timestampMatch[1] : '';
        
            // Insert the timestamp after (cont'd) in the headers of the rest of the documents
            cleanedChunks.forEach((doc, index) => {
                if (index > 0) {
                    doc.pageContent = doc.pageContent.replace(/\(cont'd\)/, `(cont'd) (${timestamp})`);
                }
            });
        }
          cleanProcessedDocs.push(...cleanedChunks);
        }
      else if (!doc.metadata.videoLink){
        let cleanedContent = removeDuplicateContent(doc.pageContent, 100);
        //tokens = encoding.encode(cleanedContent);
  
        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
          separators: ["\n**"],
        });
        cleanedContent = ensureNewlineBeforeHeaders(cleanedContent);
        const headerRegex = /^((?:[^\|]+\|)*)([^\|]+)\s*---/;
        const match = cleanedContent.match(headerRegex);
        const firstHeaderLine = match ? match[0] : null;

        const header = firstHeaderLine ? firstHeaderLine  + '\n\n' : 'Default Header\n\n---\n\n';
        let cleanedChunks = await splitter.createDocuments([cleanedContent], [doc.metadata], {
          chunkHeader: header,
          appendChunkOverlapHeader: true,
        });

        if (cleanedChunks.length > 0 && cleanedChunks[0].pageContent) {
          cleanedChunks[0].pageContent = removeDuplicatedSections(cleanedChunks[0].pageContent, header);
      }
        // Add the new smaller chunks to cleanProcessedDocs
        cleanProcessedDocs.push(...cleanedChunks);
    }
      } else {
        // Add the original document to cleanProcessedDocs
        cleanProcessedDocs.push(doc);
      }
    }
    cleanProcessedDocs = appendMissingNumbers(cleanProcessedDocs)
    
    return cleanProcessedDocs;
  }
  
  function appendMissingNumbers(cleanProcessedDocs : any) {
    let lastNumberFound = null;

    // Iterate through the documents in reverse order
    for (let i = cleanProcessedDocs.length - 1; i >= 0; i--) {
      const doc = cleanProcessedDocs[i];
      const content = doc.pageContent;
      // Search for numbers surrounded by parentheses, capturing all occurrences
      const numberMatches = content.match(/\((\d+)\)/g);
  
      if (numberMatches) {
          // Convert all matches to numbers and find the largest one
          const numbers = numberMatches.map((match : any) => parseInt(match.match(/\d+/)[0], 10));
          const largestNumber = Math.max(...numbers);
          lastNumberFound = largestNumber; // Update lastNumberFound with the largest number found
      } else {
          // If no number is found in the current document's content and we have a lastNumberFound,
          // append it to the pageContent of the current document
          if (lastNumberFound !== null) {
              cleanProcessedDocs[i].pageContent += ` (${lastNumberFound})`;
          }
      }
  }

    return cleanProcessedDocs;
}




export const run = async () => {
    try {
        /*load raw docs from GCS bucket */
        const bucketName = 'solidcam';
        const gcsLoader = new GCSLoader(bucketName);
        const rawDocs = await gcsLoader.load();
        //console.log('Number of raw documents:', rawDocs.length);

        /* Split PDF into chunks */
        const pdfTextSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
            //separators: ["\n****"],
        });
        

        /* Split webinar into chunks */
        const webinarTextSplitter = new CharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
          separator: "\n",
      });

      /* Split webinar into chunks */
      const sentinalTextSplitter = new CharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        //separators: ["\n****"],
    });
      
      // Associate each chunk with its first timestamp
      let processedDocs: any[] = [];
      let uploadDate = '';
      for (const doc of rawDocs) {
        // Initialize common variables
        const Timestamp = extractFirstTimestampInSeconds(doc.pageContent);
        const lines = doc.pageContent.split('\n');
        let initialHeader;
        let chunk;
        

        if (doc.pageHeader) {
          // Process as webinar document
          const youtubeLink = extractYouTubeLink(doc.metadata.source);
          const sentinalLink = extractSentinalLinkFromMetaDataSource(doc.metadata.source);
          if (youtubeLink) {
            let initialHeader = '';
            if (doc.pageHeader && doc.pageHeader.includes('|')) {
                const parts = doc.pageHeader.split('|').map(part => part.trim());
        
                // Extract 'Upload Date' from current document's header
                const datePartIndex = parts.findIndex(part => part.includes('Upload Date:'));
                if (datePartIndex !== -1) {
                  const currentUploadDate = parts[datePartIndex].split('Upload Date: ')[1].trim();
                  // Update uploadDate if it's different
                  if (currentUploadDate !== uploadDate) {
                    uploadDate = currentUploadDate;
                  }
                }
                
                if (parts.length > 0) {
                    initialHeader = `**${parts[0]}** ${parts.slice(1).join(' | ')}\n\n---\n\n`;
                }
            } else {
                initialHeader = `**${doc.pageHeader.trim()}**\n\n---\n\n`;
            }
            
            // Set the upload date in the metadata if it's available
            if (uploadDate) {
                doc.metadata.uploadDate = uploadDate;
            }

            chunk = await webinarTextSplitter.createDocuments([doc.pageContent], [doc.metadata], {
                chunkHeader: initialHeader,
                appendChunkOverlapHeader: true
            });

          } else if(sentinalLink) {
            let initialHeader = '';
            if (doc.pageHeader.includes('|')) {
                const parts = doc.pageHeader.split('|');
                initialHeader = `${parts[0]}\n\n---\n\n`;
            } else {
                initialHeader = `${doc.pageHeader.trim()}\n\n---\n\n`;
            }
            chunk = await sentinalTextSplitter.createDocuments([doc.pageContent], [doc.metadata], {
              chunkHeader: initialHeader,
              appendChunkOverlapHeader: true
            });
          } else {
            // Process as PDF document
            if (doc.pageHeader.includes('|')) {
              // If the page header contains '|', split it at ' | ', 
              // trim the parts, and reformat it with ' ****' and '****' added
              if (doc.pageHeader && doc.pageHeader.includes('|')) {
                // If the page header contains '|', directly split at the first occurrence
                // Find the index of the first '|' to split correctly
                const index = doc.pageHeader.indexOf('|');
                const firstPart = doc.pageHeader.substring(0, index).trim();
                // Get everything after the first '|' including other '|' characters
                const remainingParts = doc.pageHeader.substring(index + 1).trim().replace(/\|/g, '>');
        
                initialHeader = firstPart + ' ****' + remainingParts + '****\n\n---\n\n';
            } else {
                // If the page header does not contain '|', or if doc.pageHeader is undefined or empty
                initialHeader = 'Default Header\n\n---\n\n';
            }
          } else {
              // If the page header does not contain '|', 
              // check if the page header is defined
              if (doc.pageHeader) {
                   // Trim the header and wrap it with ' ****' and '****'
                  initialHeader = '****' + doc.pageHeader.trim() + '****\n\n---\n\n';
              } else {
                  // If the page header is not defined, use the default header
                  initialHeader = 'Default Header\n\n---\n\n';
              }
          }
            chunk = await pdfTextSplitter.createDocuments([doc.pageContent], [doc.metadata], {
                chunkHeader: initialHeader,
                appendChunkOverlapHeader: true
            });
        }
        } else {
            // Process as PDF document
            initialHeader = doc.pageHeader ? 
                doc.pageHeader.split(' | ')[0].trim() + ' ' + lines.find(line => line.startsWith('****') && line.endsWith('****')) + '\n\n---\n\n' : 
                'Default Header\n\n---\n\n';
            chunk = await pdfTextSplitter.createDocuments([doc.pageContent], [doc.metadata], {
                chunkHeader: initialHeader,
                appendChunkOverlapHeader: true
            });
        }
            //console.log('Chunck log', chunk);
            //await waitForUserInput();
                                
            let processedChunks: any[] = chunk ? chunk.map(document => {
              const updatedSource = Timestamp !== null
                  ? `${document.metadata.source}&t=${Timestamp}s`
                  : document.metadata.source;

              // Update the source property of the current document's metadata
              document.metadata.source = updatedSource;

              document.metadata.type = determineSourceType(updatedSource);


              //console.log('Document:', document)

              return document; // Return the updated Document object
            }): [];
            
            processedDocs.push(...processedChunks); 
      }

    processedDocs = appendMissingNumbers(processedDocs)
    //console.log('processedDocs', processedDocs);
    //await waitForUserInput();
    const cleanProcessedDocs = await checkDocumentsTokenLength(processedDocs);
    //await waitForUserInput();
    console.log('cleanProcessedDocs', cleanProcessedDocs);

      
    /*create and store the embeddings in the vectorStore*/
    const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-3-small", dimensions: 1536 });
    const pinecone = await getPinecone();
    console.log(process.env.PINECONE_API_KEY);
    console.log('ARE YOU READY TO EMBED???')
    await waitForUserInput();
    //embed the documents
    await PineconeStore.fromDocuments(cleanProcessedDocs, embeddings, {
        pineconeIndex: pinecone,
        namespace: PINECONE_NAME_SPACE,
        textKey: 'text',
    });
  } catch (error) {
      console.error('Error in run function:', error);
      throw new Error('Failed to ingest your data');
  }
};

(async () => {
  await run();
  console.log('ingestion complete');
})();
