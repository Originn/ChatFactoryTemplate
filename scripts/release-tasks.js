// scripts/release-tasks.js
const { execSync } = require('child_process');
const { pool } = require('../db');

async function runReleaseTasks() {
  try {
    // Step 1: Run existing migrations
    console.log('Running database migrations...');
    execSync('node scripts/release-migration.cjs', { stdio: 'inherit' });

    // Step 2: Add GDPR indexes
    console.log('Adding GDPR indexes...');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Corrected index creation commands based on actual database structure
      await client.query('CREATE INDEX IF NOT EXISTS idx_qa_useremail ON public.questionsandanswers (useremail)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_qa_created_at ON public.questionsandanswers (created_at)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_user_chat_history_email ON public.user_chat_history (useremail)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_user_chat_history_date ON public.user_chat_history (date)');
      
      await client.query('COMMIT');
      console.log('GDPR indexes added successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error adding GDPR indexes:', error);
      throw error;
    } finally {
      client.release();
    }
    
    console.log('All release tasks completed successfully');
  } catch (error) {
    console.error('Error in release tasks:', error);
    process.exit(1);
  }
}

// Run the release tasks
runReleaseTasks();