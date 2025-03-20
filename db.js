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

// Continue defining your functions below, with checks for `pool` availability

const insertQA = async (question, answer, embeddings, sources, qaId, roomId, userEmail, imageurl, language) => {
  if (!pool) throw new Error("Database connection pool is not available on the client side.");
  
  const query = `
    INSERT INTO QuestionsAndAnswers (question, answer, embeddings, sources, "qaId", "roomId", userEmail, imageurl, language)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;

  try {
    const embeddingsJson = JSON.stringify(embeddings);
    const sourcesJson = JSON.stringify(sources);
    const res = await pool.query(query, [question, answer, embeddingsJson, sourcesJson, qaId, roomId, userEmail, imageurl, language]);
    return res.rows[0]; // Return the inserted row
  } catch (err) {
    console.error('Error running query', err);
    throw err;
  }
};

// Assuming `pool` is your database connection pool
const updateFeedback = async (qaId, thumb, comment, roomId) => {
  const query = `
    UPDATE QuestionsAndAnswers
    SET thumb = $2, comment = $3
    WHERE "qaId" = $1 and "roomId" = $4
    RETURNING *;
  `;

  try {
    const res = await pool.query(query, [qaId, thumb, comment, roomId]);
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

const insertQuestionEmbedderDetails = async (embeddedText, timestamp, email) => {
  const query = `
    INSERT INTO "QuestionEmbedder" ("Embedded_text", "timestamp", "email")
    VALUES ($1, $2, $3)
    RETURNING *;
  `;

  try {
    const res = await pool.query(query, [embeddedText, timestamp, email]);
    return res.rows[0]; // Return the inserted row
  } catch (err) {
    console.error('Error running insertQuestionEmbedderDetails query:', err);
    throw err;
  }
};

const insertChatHistory = async (userEmail, conversationTitle, roomId, messages) => {

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
    INSERT INTO user_chat_history (useremail, conversation_title, "roomId", conversation_json)
    VALUES ($1, $2, $3, $4::jsonb)
    ON CONFLICT ("roomId")
    DO UPDATE SET
      conversation_json = $4::jsonb,
      conversation_title = $2,  -- Add this line to update the title
      date = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  try {
    const result = await pool.query(query, [
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

const getChatHistory = async (userEmail, range) => {
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
    WHERE useremail = $1 ${dateCondition}
    ORDER BY date DESC;
  `;

  try {
    const res = await pool.query(query, [userEmail]);
    return res.rows; // Return all chat history rows
  } catch (err) {
    console.error('Error fetching chat history:', err);
    throw err;
  }
};

const getChatHistoryByRoomId = async (roomId) => {
  const query = `
    SELECT conversation_json FROM user_chat_history 
    WHERE "roomId" = $1;
  `;

  try {
    const res = await pool.query(query, [roomId]);
    return res.rows[0]; // Return the chat history for this roomId
  } catch (err) {
    console.error('Error fetching chat history:', err);
    throw err;
  }
};

const getTitleByRoomId = async (roomId) => {
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

const getUserPrivacySettings = async (uid) => {
  const query = `
    SELECT * FROM user_privacy_settings 
    WHERE uid = $1;
  `;

  try {
    const res = await pool.query(query, [uid]);
    return res.rows[0]; // Return the privacy settings or undefined if not found
  } catch (err) {
    console.error('Error fetching user privacy settings:', err);
    throw err;
  }
};

// Function to update user privacy settings
const updateUserPrivacySettings = async (uid, email, allowAnalytics, storeHistory, retentionPeriod) => {
  const query = `
    INSERT INTO user_privacy_settings 
      (uid, email, allow_analytics, store_history, retention_period, updated_at)
    VALUES 
      ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (uid) 
    DO UPDATE SET
      email = $2,
      allow_analytics = $3,
      store_history = $4, 
      retention_period = $5,
      updated_at = NOW()
    RETURNING *;
  `;

  try {
    const res = await pool.query(query, [
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

// Get the user's AI provider preference
const getUserAIProvider = async (userEmail) => {
  const query = `
    SELECT ups.ai_provider 
    FROM user_privacy_settings ups 
    WHERE ups.email = $1;
  `;

  try {
    const res = await pool.query(query, [userEmail]);
    if (res.rows.length > 0) {
      return res.rows[0].ai_provider || 'openai'; // Default to openai if null
    }
    return 'openai'; // Default to openai if no record found
  } catch (err) {
    console.error('Error fetching user AI provider:', err);
    return 'openai'; // Default to openai on error
  }
};

// Get the API key for the selected provider
const getAPIKeyForProvider = async (provider, userEmail) => {
  // For OpenAI, we use the default system-wide API key
  if (provider === 'openai') {
    return process.env.OPENAI_API_KEY;
  }
  
  // For DeepSeek, use the system-wide API key
  if (provider === 'deepseek') {
    return process.env.DEEPSEEK_API_KEY;
  }
  
  // Default fallback
  return process.env.OPENAI_API_KEY;
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
};