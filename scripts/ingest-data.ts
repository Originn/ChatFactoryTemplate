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
  
    return cleanProcessedDocs;
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
        //console.log('Doc', doc);
        // Modify the source metadata to append the page number
        const Timestamp = extractFirstTimestampInSeconds(doc.pageContent);
        //const initialHeader = (doc.pageHeader || "");
        const chunk = await textSplitter.createDocuments([doc.pageContent],[doc.metadata]
        );  
        //console.log('Chunck log', chunk);
                            
                                
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

        //console.log('Processed docs with timestamps', processedDocs);

        const cleanProcessedDocs = await checkDocumentsTokenLength(processedDocs);
        await waitForUserInput();

        
      /*create and store the embeddings in the vectorStore*/
      const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-ada-002" });
      const pinecone = await getPinecone();
      const index = pinecone.Index(PINECONE_INDEX_NAME);
      
      console.log('ARE YOU READY TO EMBED???')
      await waitForUserInput();
      //embed the documents
      await PineconeStore.fromDocuments(cleanProcessedDocs, embeddings, {
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
