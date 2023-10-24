//ingest-data.ts
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { getPinecone } from '@/utils/pinecone-client';
import GCSLoader from '@/utils/GCSLoader';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { waitForUserInput, extractTimestamp, extractAndConcatenateHeaders, extractYouTubeLinkFromSingleDoc, extractFirstTimestampInSeconds, extractPotentialSubHeader } from '@/utils/textsplitter'



export const run = async () => {
    try {
        /*load raw docs from GCS bucket */
        const bucketName = 'solidcam';
        const gcsLoader = new GCSLoader(bucketName);
        const rawDocs = await gcsLoader.load();
        console.log('Number of raw documents:', rawDocs.length);

        const splitDocs: any[] = [];  // This will store the results after splitting

        /* Split text into chunks */
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
      
      // Associate each chunk with its first timestamp
      const processedDocs: any[] = [];
      
      let lastValidTimestamp: string | null = null;

      for (const doc of rawDocs) {
        console.log(doc);
        await waitForUserInput();
        // Modify the source metadata to append the page number
        const Timestamp = extractTimestamp(doc);
        const initialHeader = (doc.pageHeader || "");
        const chunk = await textSplitter.createDocuments([doc.pageContent],[doc.metadata], {chunkHeader: initialHeader + '\n\n',
        appendChunkOverlapHeader: true,});  
    
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
        
          let processedChunks: any[] = chunk;

          if (Timestamp) {
            processedChunks = chunk.map(document => {
                const timestampInSeconds = extractFirstTimestampInSeconds(document.pageContent);
                const updatedSource = timestampInSeconds !== null 
                    ? `${document.metadata.source}&t=${timestampInSeconds}s` 
                    : document.metadata.source;
        
                // Update the source property of the current document's metadata
                document.metadata.source = updatedSource;
        
                return document; // Return the updated Document object
            });
        }        
        processedDocs.push(...processedChunks);        
        }
        console.log('Processed docs with timestamps', processedDocs);

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
