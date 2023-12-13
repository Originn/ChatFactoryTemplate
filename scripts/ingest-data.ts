//ingest-data.ts
import { CharacterTextSplitter, RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { getPinecone } from '@/utils/pinecone-client';
import GCSLoader from '@/utils/GCSLoader';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { waitForUserInput, extractFirstTimestampInSeconds, extractPotentialSubHeader } from '@/utils/textsplitter'

import { get_encoding, encoding_for_model } from 'tiktoken';

let encoding =  get_encoding("cl100k_base")
 encoding = encoding_for_model("gpt-3.5-turbo");

function determineSourceType(url: string): string {
    if (url.includes('youtube')) return 'youtube';
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
  
  async function checkDocumentsTokenLength(processedDocs: any[]): Promise<any[]> {
    let cleanProcessedDocs: any[] = [];
  
    for (const doc of processedDocs) {
      //console.log("doc:", doc);
      let tokens = encoding.encode(doc.pageContent);
  
      if (tokens.length > 1200) {
        const cleanedContent = removeDuplicateContent(doc.pageContent, 100);
        tokens = encoding.encode(cleanedContent);
  
        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
          separators: ["\n**"],
        });
  
        const lines = cleanedContent.split('\n');
        const firstHeaderLine = lines.find(line => line.startsWith('**') && line.endsWith('**'));
        const header = firstHeaderLine ? firstHeaderLine + '\n\n---\n\n' : 'Default Header\n\n---\n\n';
  
        const cleanedChunks = await splitter.createDocuments([cleanedContent], [doc.metadata], {
          chunkHeader: header,
          appendChunkOverlapHeader: true,
        });
  
        // Add the new smaller chunks to cleanProcessedDocs
        cleanProcessedDocs.push(...cleanedChunks);
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
        const numberMatch = content.match(/\((\d+)\)/g);

        if (numberMatch) {
            // Found a number at the end of this document
            const currentNumber = numberMatch;

            if (lastNumberFound === null || currentNumber < lastNumberFound) {
                // Update lastNumberFound if it's null or current number is smaller
                lastNumberFound = currentNumber;
            }
        } else if (lastNumberFound !== null && i !== cleanProcessedDocs.length - 1) {
            // Append the last found number to the previous document if this one doesn't end with a number
            // and it's not the last document in the array
            cleanProcessedDocs[i].pageContent += ` ${lastNumberFound}`;
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
          //separators: ["\n****"],
      });
      
      // Associate each chunk with its first timestamp
      let processedDocs: any[] = [];

      for (const doc of rawDocs) {
        // Initialize common variables
    const Timestamp = extractFirstTimestampInSeconds(doc.pageContent);
    const lines = doc.pageContent.split('\n');
    let initialHeader;
    let chunk;

    if (doc.pageHeader) {
      // Process as webinar document
      let initialHeader = '';
      if (doc.pageHeader.includes('|')) {
          const parts = doc.pageHeader.split('|');
          initialHeader = `**${parts[0].trim()}** ${parts.slice(1).join('|').trim()}\n\n---\n\n`;
      } else {
          initialHeader = `**${doc.pageHeader.trim()}**\n\n---\n\n`;
      }

      chunk = await webinarTextSplitter.createDocuments([doc.pageContent], [doc.metadata], {
          chunkHeader: initialHeader,
          appendChunkOverlapHeader: true
      });
    } else {
        // Process as PDF document
        initialHeader = doc.pageHeader ? 
            doc.pageHeader.split('|')[0].trim() + ' ' + lines.find(line => line.startsWith('****') && line.endsWith('****')) + '\n\n---\n\n' : 
            'Default Header\n\n---\n\n';
        chunk = await pdfTextSplitter.createDocuments([doc.pageContent], [doc.metadata], {
            chunkHeader: initialHeader,
            appendChunkOverlapHeader: true
        });
    }
        //console.log('Chunck log', chunk);
        //await waitForUserInput();
                            
          let processedChunks: any[] = chunk;

            processedChunks = chunk.map(document => {

                const updatedSource = Timestamp !== null
                    ? `${document.metadata.source}&t=${Timestamp}s`
                    : document.metadata.source;

                // Update the source property of the current document's metadata
                document.metadata.source = updatedSource;

                document.metadata.type = determineSourceType(updatedSource);

                //console.log('Document:', document)

                return document; // Return the updated Document object
            });

        processedDocs.push(...processedChunks);        
        }

        processedDocs = appendMissingNumbers(processedDocs)
        console.log('processedDocs', processedDocs);
        //await waitForUserInput();
        //const cleanProcessedDocs = await checkDocumentsTokenLength(processedDocs);
        //console.log('cleanProcessedDocs', cleanProcessedDocs);
        //await waitForUserInput();

        
      /*create and store the embeddings in the vectorStore*/
      const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-ada-002" });
      const pinecone = await getPinecone();
      const index = pinecone.Index(PINECONE_INDEX_NAME);
      
      console.log('ARE YOU READY TO EMBED???')
      await waitForUserInput();
      //embed the documents
      await PineconeStore.fromDocuments(processedDocs, embeddings, {
          pineconeIndex: index,
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
