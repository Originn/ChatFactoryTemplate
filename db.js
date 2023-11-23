import { Pool } from 'pg';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const isProduction = process.env.NODE_ENV === 'production';
const poolConfig = isProduction ? {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Heroku Postgres
  },
} : {
  connectionString: process.env.DATABASE_URL,
  // In non-production environments, do not use SSL
  ssl: false,
};

const pool = new Pool(poolConfig);

const insertQA = async (question, answer, embeddings, qaId, roomId) => {
  const query = `
    INSERT INTO QuestionsAndAnswers (question, answer, embeddings, qaId, roomId)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;

  try {
    // Ensure embeddings is a JSON string
    const embeddingsJson = JSON.stringify(embeddings);

    const res = await pool.query(query, [question, answer, embeddingsJson, qaId, roomId]);
    console.log(res.rows[0]); // Output the inserted row to the console
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
  WHERE qaId = $1 and roomId = $4
  RETURNING *;
`;

  try {
    const res = await pool.query(query, [qaId, thumb, comment, roomId]);
    console.log('Updated feedback:', res.rows[0]); // Log the updated row
    return res.rows[0]; // Return the updated row
  } catch (err) {
    // Check if error is an instance of Error
    if (err instanceof Error) {
      console.error('Error running updateFeedback query:', err.message, 'Stack:', err.stack);
    } else {
      console.error('Unknown error running updateFeedback query');
    }
    throw err;  // Rethrow the error to be caught by the calling handler
  }
};



export { pool, insertQA, updateFeedback };
