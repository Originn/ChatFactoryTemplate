//config/pinecone.ts

if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error('Missing Pinecone index name in .env file');
}

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;

const PINECONE_NAME_SPACE = 'default'; //namespace is optional for your vectors

export { 
    PINECONE_INDEX_NAME, 
    PINECONE_NAME_SPACE,
};