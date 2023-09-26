//ingest-data.ts
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { pinecone } from '@/utils/pinecone-client';
import GCSLoader from '@/utils/GCSLoader';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';

export function extractYouTubeLink(content: string): string | null {
  const youtubeMatch = content.match(/https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/);
  return youtubeMatch ? youtubeMatch[0] : null;
}

function extractFirstTimestampInSeconds(content: string): number | null {
    const timestampMatch = content.match(/\((?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})\)/);
    if (!timestampMatch) {
        // Match the pattern (MM:SS)
        const minSecMatch = content.match(/\((\d{1,2}):(\d{1,2})\)/);
        if (minSecMatch) {
            const minutes = Number(minSecMatch[1]);
            const seconds = Number(minSecMatch[2]);
            return minutes * 60 + seconds;
        }
        return null;
    }
    const hours = timestampMatch[1] ? Number(timestampMatch[1]) : 0;
    const minutes = Number(timestampMatch[2]);
    const seconds = Number(timestampMatch[3]);

    return hours * 3600 + minutes * 60 + seconds;
}



function extractYouTubeLinkFromSingleDoc(document: any): string | null {
  return extractYouTubeLink(document.pageContent);
}

export const run = async () => {
  try {
      /*load raw docs from GCS bucket */
      const bucketName = 'solidcam';
      const gcsLoader = new GCSLoader(bucketName);
      const rawDocs = await gcsLoader.load();
      

      /* Split text into chunks */
      const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
      });

      // Associate each chunk with its first timestamp
      const processedDocs: any[] = [];
      
      let lastValidTimestamp: string | null = null;

      for (const doc of rawDocs) {
          const YouTubeLink = extractYouTubeLinkFromSingleDoc(doc);
          const chunks = await textSplitter.splitDocuments([doc]);

          let processedChunks: any[] = chunks;

          if (YouTubeLink) {
              processedChunks = chunks.map(chunk => {
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
                          source: updatedSource
                      }
                  };
              });
          }

          processedDocs.push(...processedChunks);
      }

      console.log('Processed docs with timestamps', processedDocs);

      console.log('creating vector store...');
      /*create and store the embeddings in the vectorStore*/
      const embeddings = new OpenAIEmbeddings();
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
