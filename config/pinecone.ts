//config/pinecone.ts

if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error('Missing Pinecone index name in .env file');
}

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;

// Enhanced namespace logic with better fallback
const PINECONE_NAME_SPACE = process.env.PINECONE_NAMESPACE || 
                           process.env.NEXT_PUBLIC_CHATBOT_NAME?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 
                           process.env.NEXT_PUBLIC_CHATBOT_ID || 
                           'default';

export { 
    PINECONE_INDEX_NAME, 
    PINECONE_NAME_SPACE,
};