//config/pinecone.ts

if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error('Missing Pinecone index name in .env file');
}

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME ?? '{{PINECONE_INDEX_NAME}}'; // Will be replaced during deployment

const PINECONE_NAME_SPACE = 'default'; //namespace is optional for your vectors
const PINECONE_NAMESPACE_JINA = '{{COMPANY_DOMAIN}}-jina'; //namespace for Jina vectors - will be replaced during deployment

export { 
    PINECONE_INDEX_NAME, 
    PINECONE_NAME_SPACE,
    PINECONE_NAMESPACE_JINA 
};