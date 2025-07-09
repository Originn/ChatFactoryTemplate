// SOLUTION: Enhanced namespace configuration
// This ensures the namespace is properly set and debugged

// config/pinecone.ts
if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error('Missing Pinecone index name in .env file');
}

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;

// Enhanced namespace logic with better fallback
const PINECONE_NAME_SPACE = process.env.PINECONE_NAMESPACE || 
                           process.env.NEXT_PUBLIC_CHATBOT_NAME?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 
                           process.env.NEXT_PUBLIC_CHATBOT_ID || 
                           'default';

// Debug logging for namespace (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('🔍 Namespace Debug:');
  console.log('  PINECONE_NAMESPACE:', process.env.PINECONE_NAMESPACE);
  console.log('  NEXT_PUBLIC_CHATBOT_NAME:', process.env.NEXT_PUBLIC_CHATBOT_NAME);
  console.log('  NEXT_PUBLIC_CHATBOT_ID:', process.env.NEXT_PUBLIC_CHATBOT_ID);
  console.log('  Final namespace:', PINECONE_NAME_SPACE);
}

export { 
    PINECONE_INDEX_NAME, 
    PINECONE_NAME_SPACE,
};
