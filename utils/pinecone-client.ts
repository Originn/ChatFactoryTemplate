import { Pinecone } from '@pinecone-database/pinecone';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('Pinecone API key var is missing');
}

// Assuming that the index name is stored in an environment variable
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'quickstart';

let pineconeInstance : any;



export const getPinecone = () => {
  if (!pineconeInstance) {
    
    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || '' // Provide a default empty string as fallback
    });
    pineconeInstance = pc.index(PINECONE_INDEX_NAME);
    
  }
  
  return pineconeInstance;
};
