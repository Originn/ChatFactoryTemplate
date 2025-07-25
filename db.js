let pool;

if (typeof window === 'undefined') {
  // Import dotenv only in server environment
  const dotenv = require('dotenv');
  if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
  }

  const { Pool } = require('pg');

  console.log(process.env.NODE_ENV);
  const isProduction = process.env.NODE_ENV === 'production';

  const poolConfig = isProduction
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false, // Required for Heroku Postgres
        },
      }
    : {
        connectionString: process.env.DATABASE_URL, // In non-production environments, do not use SSL
        ssl: false,
      };

  pool = new Pool(poolConfig);
} else {
  pool = null; // On the client side, pool should be null to prevent usage
}

// Helper function to set tenant context for Row Level Security
const setTenantContext = async (chatbotId) => {
  if (!pool || !chatbotId) return;
  
  try {
    await pool.query(`SET app.current_chatbot_id = '${chatbotId}'`);
  } catch (error) {
    console.error('Failed to set tenant context:', error);
  }
};

// Continue defining your functions below, with checks for `pool` availability

const insertQA = async (chatbotId, question, answer, embeddings, sources, qaId, roomId, userEmail, imageurl, language, modelType = 'openai', contextualizedQuestion = null) => {
  // Check if pool is available (server-side only)
  if (!pool) {
    console.warn("Database connection pool is not available on the client side.");
    return null; // Return null to indicate no data available
  }

  // Set tenant context for Row Level Security
  await setTenantContext(chatbotId);

  const query = `
    INSERT INTO questions_and_answers (chatbot_id, question, answer, embeddings, sources, qa_id, room_id, user_email, imageurl, language, model_type, contextualized_question)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *;
  `;

  try {
    const embeddingsJson = JSON.stringify(embeddings);
    const sourcesJson = JSON.stringify(sources);
    const res = await pool.query(query, [chatbotId, question, answer, embeddingsJson, sourcesJson, qaId, roomId, userEmail, imageurl, language, modelType, contextualizedQuestion]);
    return res.rows[0]; // Return the inserted row
  } catch (err) {
    console.error('Error running query', err);
    throw err;
  }
};


// Assuming `pool` is your database connection pool
const updateFeedback = async (chatbotId, qaId, thumb, comment, roomId) => {
  // Check if pool is available (server-side only)
  if (!pool) {
    console.warn("Database connection pool is not available on the client side.");
    return null; // Return null to indicate no data available
  }

  // Set tenant context for Row Level Security
  await setTenantContext(chatbotId);
  
  const query = `
    UPDATE questions_and_answers
    SET thumb = $3, comment = $4
    WHERE chatbot_id = $1 AND qa_id = $2 AND room_id = $5
    RETURNING *;
  `;

  try {
    const res = await pool.query(query, [chatbotId, qaId, thumb, comment, roomId]);
    return res.rows[0]; // Return the updated row
  } catch (err) {
    // Check if error is an instance of Error
    if (err instanceof Error) {
      console.error('Error running updateFeedback query:', err.message, 'Stack:', err.stack);
    } else {
      console.error('Unknown error running updateFeedback query');
    }
    throw err; // Rethrow the error to be caught by the calling handler
  }
};

const insertQuestionEmbedderDetails = async (chatbotId, embeddedText, timestamp, email) => {
  // Check if pool is available (server-side only)
  if (!pool) {
    console.warn("Database connection pool is not available on the client side.");
    return null; // Return null to indicate no data available
  }

  // Set tenant context for Row Level Security
  await setTenantContext(chatbotId);
  
  const query = `
    INSERT INTO question_embedder (chatbot_id, embedded_text, timestamp, email)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;

  try {
    const res = await pool.query(query, [chatbotId, embeddedText, timestamp, email]);
    return res.rows[0]; // Return the inserted row
  } catch (err) {
    console.error('Error running insertQuestionEmbedderDetails query:', err);
    throw err;
  }
};

const insertChatHistory = async (chatbotId, userEmail, conversationTitle, roomId, messages) => {
  // Check if pool is available (server-side only)
  if (!pool) {
    console.warn("Database connection pool is not available on the client side.");
    return null; // Return null to indicate no data available
  }

  // Set tenant context for Row Level Security
  await setTenantContext(chatbotId);
  // Helper function to get all previous image URLs
  const getPreviousImageUrls = (messages) => {
    const imageUrls = new Set();
    for (const message of messages) {
      if (message.imageUrls && Array.isArray(message.imageUrls)) {
        message.imageUrls.forEach(url => imageUrls.add(url));
      }
    }
    return imageUrls;
  };

  // Process messages to deduplicate image URLs
  const processedMessages = messages.map((message, index) => {
    if (message.type !== 'userMessage' || !message.imageUrls) {
      return message;
    }

    // Get all image URLs from previous messages
    const previousMessages = messages.slice(0, index);
    const previousImageUrls = getPreviousImageUrls(previousMessages);

    // Filter out duplicate image URLs
    const uniqueImageUrls = message.imageUrls.filter(url => !previousImageUrls.has(url));

    return {
      ...message,
      imageUrls: uniqueImageUrls
    };
  });

  const query = `
    INSERT INTO user_chat_history (chatbot_id, user_email, conversation_title, room_id, conversation_json)
    VALUES ($1, $2, $3, $4, $5::jsonb)
    ON CONFLICT (chatbot_id, room_id)
    DO UPDATE SET
      conversation_json = $5::jsonb,
      conversation_title = $3,
      date = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  try {
    const result = await pool.query(query, [
      chatbotId,
      userEmail,
      conversationTitle,
      roomId,
      JSON.stringify(processedMessages)
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error inserting chat history:', error);
    throw error;
  }
};

const getChatHistory = async (chatbotId, userEmail, range) => {
  // Check if pool is available (server-side only)
  if (!pool) {
    console.warn("Database connection pool is not available on the client side.");
    return []; // Return empty array to indicate no data available
  }

  // Set tenant context for Row Level Security
  await setTenantContext(chatbotId);
  
  let dateCondition = '';

  if (range === 'today') {
    dateCondition = "AND date::date = CURRENT_DATE";
  } else if (range === 'yesterday') {
    dateCondition = "AND date::date = CURRENT_DATE - INTERVAL '1 day'";
  } else if (range === '7days') {
    dateCondition = "AND date >= NOW() - INTERVAL '7 days'";
  } else if (range === '30days') {
    dateCondition = "AND date >= NOW() - INTERVAL '30 days'";
  } else if (range === 'all') {
    dateCondition = ''; // No date condition for 'all'
  }

  const query = `
    SELECT * FROM user_chat_history 
    WHERE chatbot_id = $1 AND user_email = $2 ${dateCondition}
    ORDER BY date DESC;
  `;

  try {
    const res = await pool.query(query, [chatbotId, userEmail]);
    return res.rows; // Return all chat history rows
  } catch (err) {
    console.error('Error fetching chat history:', err);
    throw err;
  }
};

const getChatHistoryByRoomId = async (chatbotId, roomId) => {
  // Check if pool is available (server-side only)
  if (!pool) {
    console.warn("Database connection pool is not available on the client side.");
    return null; // Return null to indicate no data available
  }

  // Set tenant context for Row Level Security
  await setTenantContext(chatbotId);
  
  const query = `
    SELECT conversation_json FROM user_chat_history 
    WHERE chatbot_id = $1 AND room_id = $2;
  `;

  try {
    const res = await pool.query(query, [chatbotId, roomId]);
    return res.rows[0]; // Return the chat history for this roomId
  } catch (err) {
    console.error('Error fetching chat history:', err);
    throw err;
  }
};

const getTitleByRoomId = async (roomId) => {
  // Check if pool is available (server-side only)
  if (!pool) {
    console.warn("Database connection pool is not available on the client side.");
    return null; // Return null to indicate no data available
  }
  
  const query = `
    SELECT conversation_title FROM user_chat_history 
    WHERE "roomId" = $1;
  `;

  try {
    const res = await pool.query(query, [roomId]);
    return res.rows[0]; // Return the chat history for this roomId
  } catch (err) {
    console.error('Error fetching conversation title:', err);
    throw err;
  }
};

const deleteOldChatHistory = async () => {
  // Check if pool is available (server-side only)
  if (!pool) {
    console.warn("Database connection pool is not available on the client side.");
    return 0; // Return 0 to indicate no rows deleted
  }
  
  const query = `
    DELETE FROM user_chat_history
    WHERE date < NOW() - INTERVAL '30 days'
    RETURNING *;
  `;

  try {
    const res = await pool.query(query);
    return res.rowCount;
  } catch (err) {
    console.error('Error deleting old chat history:', err);
    throw err;
  }
};

const getUserPrivacySettings = async (chatbotId, uid) => {
  // Check if pool is available (server-side only)
  if (!pool) {
    console.warn("Database connection pool is not available on the client side.");
    return null; // Return null to indicate no data available
  }

  // Set tenant context for Row Level Security
  await setTenantContext(chatbotId);
  
  const query = `
    SELECT * FROM user_privacy_settings 
    WHERE chatbot_id = $1 AND uid = $2;
  `;

  try {
    const res = await pool.query(query, [chatbotId, uid]);
    return res.rows[0]; // Return the privacy settings or undefined if not found
  } catch (err) {
    console.error('Error fetching user privacy settings:', err);
    throw err;
  }
};

// Function to update user privacy settings
const updateUserPrivacySettings = async (chatbotId, uid, email, allowAnalytics, storeHistory, retentionPeriod) => {
  // Check if pool is available (server-side only)
  if (!pool) {
    console.warn("Database connection pool is not available on the client side.");
    return null; // Return null to indicate no data available
  }

  // Set tenant context for Row Level Security
  await setTenantContext(chatbotId);
  
  const query = `
    INSERT INTO user_privacy_settings 
      (chatbot_id, uid, email, allow_analytics, store_history, retention_period, updated_at)
    VALUES 
      ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (uid) 
    DO UPDATE SET
      email = $3,
      allow_analytics = $4,
      store_history = $5, 
      retention_period = $6,
      updated_at = NOW()
    RETURNING *;
  `;

  try {
    const res = await pool.query(query, [
      chatbotId,
      uid,
      email,
      allowAnalytics,
      storeHistory,
      retentionPeriod
    ]);
    return res.rows[0]; // Return the updated privacy settings
  } catch (err) {
    console.error('Error updating user privacy settings:', err);
    throw err;
  }
};

// Get the user's AI provider preference (always returns 'openai' since DeepSeek is removed)
const getUserAIProvider = async (userEmail) => {
  return 'openai'; // Always use OpenAI
};

// Get the API key for OpenAI
const getAPIKeyForProvider = async (provider, userEmail) => {
  // API keys should only be available on the server side
  if (typeof window !== 'undefined') {
    console.warn("API keys are only available on the server side.");
    return null; // Return null on client-side
  }
  
  // For anonymous users or invalid emails, return default API key
  if (!userEmail || userEmail === 'anonymous' || userEmail === 'anon') {
    console.log('Using default API key for anonymous user');
    return process.env.OPENAI_API_KEY;
  }
  
  // Return OpenAI API key (could be enhanced to get user-specific keys later)
  return process.env.OPENAI_API_KEY;
};

// Cache embedding (like TornosChatBot)
const cacheEmbedding = async (chatbotId, contentHash, modelName, embedding, contentText = null) => {
  if (!pool) return null;
  await setTenantContext(chatbotId);

  const query = `
    INSERT INTO document_embeddings (chatbot_id, content_hash, model_name, embedding, content_text)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (chatbot_id, content_hash, model_name)
    DO UPDATE SET embedding = EXCLUDED.embedding, content_text = EXCLUDED.content_text
    RETURNING *;
  `;

  try {
    const embeddingArray = Array.isArray(embedding) ? embedding : JSON.parse(embedding);
    const res = await pool.query(query, [chatbotId, contentHash, modelName, embeddingArray, contentText]);
    return res.rows[0];
  } catch (err) {
    console.error('Error caching embedding:', err);
    throw err;
  }
};

// Get cached embedding (like TornosChatBot)
const getCachedEmbedding = async (chatbotId, contentHash, modelName = 'text-embedding-3-small') => {
  if (!pool) return null;
  await setTenantContext(chatbotId);

  const query = `SELECT * FROM document_embeddings WHERE chatbot_id = $1 AND content_hash = $2 AND model_name = $3;`;

  try {
    const res = await pool.query(query, [chatbotId, contentHash, modelName]);
    return res.rows[0];
  } catch (err) {
    console.error('Error retrieving cached embedding:', err);
    throw err;
  }
};


module.exports = { 
  pool, 
  insertQA, 
  updateFeedback, 
  insertQuestionEmbedderDetails, 
  insertChatHistory, 
  getChatHistory, 
  getChatHistoryByRoomId, 
  deleteOldChatHistory,
  getTitleByRoomId,
  getUserPrivacySettings,
  updateUserPrivacySettings,
  getUserAIProvider,
  getAPIKeyForProvider,
  cacheEmbedding,
  getCachedEmbedding,
};