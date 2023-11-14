//ingest-data.ts
import { CharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { getPinecone } from '@/utils/pinecone-client';
import GCSLoader from '@/utils/GCSLoader';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { waitForUserInput, extractTimestamp, extractAndConcatenateHeaders, extractYouTubeLinkFromSingleDoc, extractFirstTimestampInSeconds, extractPotentialSubHeader } from '@/utils/textsplitter'

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
  
  async function checkDocumentsTokenLength(processedDocs: any[]) {
    for (const doc of processedDocs) {
      // Remove duplicate content from the page content.
  
      // Now check the token count of the cleaned content.
      let tokens = encoding.encode(doc.pageContent);
  
      console.log(`Document with cleaned content has ${tokens.length} tokens.`);
  
      if (tokens.length > 5000) {
        console.log(`Document with pageContent "${doc.pageContent}" has ${tokens.length} tokens.`);
        await waitForUserInput();
        const cleanedContent = removeDuplicateContent(doc.pageContent, 100);
        tokens = encoding.encode(cleanedContent);
        console.log(`cleanedContent Document "${cleanedContent}" has ${tokens.length} tokens.`);
        await waitForUserInput();
        // Handle the case where the token count is too high.
      } else {
        // Proceed with embedding if token count is within limits.
        // Embedding logic goes here.
      }
    }
  }


export const run = async () => {
    try {
        /*load raw docs from GCS bucket */
        const bucketName = 'solidcam';
        const gcsLoader = new GCSLoader(bucketName);
        const rawDocs = await gcsLoader.load();
        //console.log('Number of raw documents:', rawDocs.length);

        /* Split text into chunks */
        const textSplitter = new CharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
      
      // Associate each chunk with its first timestamp
      const processedDocs: any[] = [];

      for (const doc of rawDocs) {
        console.log('Doc', doc);
        // Modify the source metadata to append the page number
        const Timestamp = extractFirstTimestampInSeconds(doc.pageContent);
        const initialHeader = (doc.pageHeader || "");
        const chunk = await textSplitter.createDocuments([doc.pageContent],[doc.metadata]
        );  
        console.log('Chunck log', chunk);
    
        if (chunk.length > 1) {
            // Extract headers from the first chunk
            const potentialSubHeaderFirst = extractPotentialSubHeader(chunk[0].pageContent);

            if (initialHeader) {
                const newHeaderFirst = potentialSubHeaderFirst ? `${initialHeader} | ${potentialSubHeaderFirst}` : initialHeader;
                
                chunk.map((document, index) => {
                    if (index === 1 && initialHeader) {
                        document.pageContent = document.pageContent.replace(initialHeader, newHeaderFirst);
                    }
                    return document;
                });                                    

                // Start from the third chunk and prepend the header from the first chunk and subheader from previous chunk
                for (let i = 2; i < chunk.length; i++) {
                    const potentialSubHeader = extractPotentialSubHeader(chunk[i - 1].pageContent);
                    const newHeader = potentialSubHeader ? `${initialHeader} | ${potentialSubHeader}` : initialHeader;
                    chunk.map((document, index) => {
                        if (index === i && initialHeader) {
                            document.pageContent = document.pageContent.replace(initialHeader, newHeader);
                        }
                        return document;
                    });    
                }
                
            }      
        } 
        // console.log('Chunck log2', chunk);
        // await waitForUserInput();
          let processedChunks: any[] = chunk;

            processedChunks = chunk.map(document => {

                const updatedSource = Timestamp !== null
                    ? `${document.metadata.source}&t=${Timestamp}s`
                    : document.metadata.source;

                // Update the source property of the current document's metadata
                document.metadata.source = updatedSource;

                document.metadata.type = determineSourceType(updatedSource);

                console.log('Document:', document)

                return document; // Return the updated Document object
            });

        processedDocs.push(...processedChunks);        
        }

        
        console.log('Processed docs with timestamps', processedDocs);

        await checkDocumentsTokenLength(processedDocs);
        await waitForUserInput();

        
      /*create and store the embeddings in the vectorStore*/
      const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-ada-002" });
      const pinecone = await getPinecone();
      const index = pinecone.Index(PINECONE_INDEX_NAME);

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
