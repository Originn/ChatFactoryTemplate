//ingest-data.ts
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { pinecone } from '@/utils/pinecone-client';
import GCSLoader from '@/utils/GCSLoader';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { waitForUserInput, extractAndConcatenateHeaders, extractYouTubeLinkFromSingleDoc, extractFirstTimestampInSeconds, extractPotentialSubHeader } from '@/utils/textsplitter'



export const run = async () => {
    try {
        /*load raw docs from GCS bucket */
        const bucketName = 'solidcam';
        const gcsLoader = new GCSLoader(bucketName);
        const rawDocs = await gcsLoader.load();
        // console.log(rawDocs.slice(0, 10));
        // await waitForUserInput();

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
        // Modify the source metadata to append the page number
        //doc.metadata.source += `#page=${doc.pageNumber}`;

        const YouTubeLink = extractYouTubeLinkFromSingleDoc(doc);
        const initialHeader = (doc.pageHeader || "");
        const chunk = await textSplitter.createDocuments([doc.pageContent],[doc.metadata], {chunkHeader: initialHeader + '\n\n',
        appendChunkOverlapHeader: true,});
        console.log('chunk:',chunk)
        // await waitForUserInput();  
    
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

                console.log('updatedChunks:', chunk);

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
                console.log('updatedChunks1:', chunk);
                
            }      
        } 
        
          let processedChunks: any[] = chunk;

          if (YouTubeLink) {
              processedChunks = chunk.map(chunk => {
                  const currentTimestampMatch = chunk.pageContent.match(/\((\d+:\d+)\)/);
                  const currentTimestamp = currentTimestampMatch ? currentTimestampMatch[1] : null;

                  // If there's a timestamp for the current chunk, update the lastValidTimestamp
                  if (currentTimestamp) {
                      lastValidTimestamp = currentTimestamp;
                  }

                  // If there's no timestamp for the current chunk but there's a lastValidTimestamp, prepend it
                  if (!currentTimestamp && lastValidTimestamp) {
                      chunk.pageContent = `(${lastValidTimestamp}) ${chunk.pageContent}`;
                  }
                  
                  const timestampInSeconds = extractFirstTimestampInSeconds(chunk.pageContent);
                  const updatedSource = timestampInSeconds !== null 
                      ? `${YouTubeLink}&t=${timestampInSeconds}s` 
                      : YouTubeLink;

                  return {
                      ...chunk,
                      metadata: {
                          ...chunk.metadata,
                          source: updatedSource,
                      }
                  };
              });
          }
          processedDocs.push(...processedChunks);
      }

      console.log('Processed docs with timestamps', processedDocs);

      await waitForUserInput();

      console.log('creating vector store...');
      /*create and store the embeddings in the vectorStore*/
      const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-ada-002" });
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
