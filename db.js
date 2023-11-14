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

const insertQA = async (question, answer) => {
  const query = `
    INSERT INTO QuestionsAndAnswers (question, answer)
    VALUES ($1, $2)
    RETURNING *;
  `;

  try {
    const res = await pool.query(query, [question, answer]);
    console.log(res.rows[0]); // Output the inserted row to the console
    return res.rows[0];
  } catch (err) {
    console.error('Error running query', err);
    throw err;
  }
};

export { pool, insertQA };
