//config/pinecone.ts

if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error('Missing Pinecone index name in .env file');
}

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME ?? 'solidcam';

const PINECONE_NAME_SPACE = 'default'; //namespace is optional for your vectors
const PINECONE_NAMESPACE_JINA = 'solidcam-jina'; //namespace for Jina vectors

export { 
    PINECONE_INDEX_NAME, 
    PINECONE_NAME_SPACE,
    PINECONE_NAMESPACE_JINA 
};