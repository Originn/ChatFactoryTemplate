// scripts/monthly-anonymization.js

const { pool } = require('../db');

/**
 * Monthly scheduled function for anonymization of old QA data and chat history
 * This script should be scheduled to run daily but will only execute on the first day of each month
 */
async function anonymizeOldQAData() {
  // Check if today is the first day of the month
  const today = new Date();
  if (today.getDate() !== 1) {
    console.log('Today is not the first day of the month. Skipping execution.');
    return;
  }
  
  console.log(`[${today.toISOString()}] Starting monthly GDPR data anonymization process...`);
  
  // Performance metrics
  const startTime = Date.now();
  let totalUsersProcessed = 0;
  let totalQARecordsAnonymized = 0;
  let totalChatHistoryDeleted = 0;
  
  // Get a client from the pool
  const client = await pool.connect();
  
  try {
    // Get all users with their retention settings
    console.log('Fetching all users with their retention settings...');
    const usersQuery = 'SELECT u.email, ps.retention_period FROM users u LEFT JOIN user_privacy_settings ps ON u.uid = ps.uid';
    const usersResult = await client.query(usersQuery);
    const users = usersResult.rows;
    
    console.log(`Found ${users.length} users to process`);
    
    // Process users in batches to avoid long-running transactions
    const BATCH_SIZE = 50;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(users.length / BATCH_SIZE);
      console.log(`Processing batch ${batchNumber} of ${totalBatches}`);
      
      const userBatch = users.slice(i, Math.min(i + BATCH_SIZE, users.length));
      
      // Start a transaction for this batch
      await client.query('BEGIN');
      
      try {
        for (const user of userBatch) {
          const { email, retention_period } = user;
          totalUsersProcessed++;
          
          // Default to 1 month if no retention_period is set
          const retentionPeriod = retention_period || '1month';
          
          // Skip users with retention period set to 'forever'
          if (retentionPeriod === 'forever') {
            console.log(`[User ${totalUsersProcessed}/${users.length}] Skipping user ${email} with retention period 'forever'`);
            continue;
          }
          
          // Determine the appropriate interval
          let interval;
          switch (retentionPeriod) {
            case '1year':
              interval = '1 year';
              break;
            case '6months':
              interval = '6 months';
              break;
            case '3months':
              interval = '3 months';
              break;
            case '1month':
            default:
              interval = '1 month';
              break;
          }
          
          console.log(`[User ${totalUsersProcessed}/${users.length}] Processing user ${email} with retention period: ${interval}`);
          
          // Anonymize QA data older than retention period
          const anonymizeQuery = `
            UPDATE QuestionsAndAnswers 
            SET userEmail = 'anon-' || SUBSTR(MD5(userEmail), 1, 8),
                question = REGEXP_REPLACE(question, '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b', '[EMAIL REDACTED]'),
                question = REGEXP_REPLACE(question, '\\b\\d{10,16}\\b', '[NUMBER REDACTED]'),
                question = REGEXP_REPLACE(question, '\\b\\d{3}[- ]?\\d{2}[- ]?\\d{4}\\b', '[SSN REDACTED]')
            WHERE userEmail = $1 
            AND created_at < NOW() - INTERVAL '${interval}'
            RETURNING id
          `;
          
          try {
            const qaResult = await client.query(anonymizeQuery, [email]);
            const anonymizedCount = qaResult.rowCount;
            totalQARecordsAnonymized += anonymizedCount;
            console.log(`  - Anonymized ${anonymizedCount} QA records`);
          } catch (queryError) {
            console.error(`  - Error anonymizing QA data for ${email}:`, queryError.message);
            // Continue with next steps even if this one fails
          }
          
          // Delete chat history older than retention period
          const deleteHistoryQuery = `
            DELETE FROM user_chat_history 
            WHERE useremail = $1 
            AND date < NOW() - INTERVAL '${interval}'
            RETURNING id
          `;
          
          try {
            const deleteResult = await client.query(deleteHistoryQuery, [email]);
            const deletedCount = deleteResult.rowCount;
            totalChatHistoryDeleted += deletedCount;
            console.log(`  - Deleted ${deletedCount} chat history records`);
          } catch (queryError) {
            console.error(`  - Error deleting chat history for ${email}:`, queryError.message);
            // Continue with next user even if this one fails
          }
        }
        
        // Commit the transaction for this batch
        await client.query('COMMIT');
        console.log(`Batch ${batchNumber}/${totalBatches} completed successfully`);
        
      } catch (batchError) {
        // If any error occurs in this batch, roll back the entire batch
        await client.query('ROLLBACK');
        console.error(`Error processing batch ${batchNumber}/${totalBatches}:`, batchError);
        console.error('Batch rolled back, continuing with next batch');
      }
    }
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`[${new Date().toISOString()}] Monthly anonymization process completed:`);
    console.log(`- Total runtime: ${duration.toFixed(2)} seconds`);
    console.log(`- Users processed: ${totalUsersProcessed}`);
    console.log(`- QA records anonymized: ${totalQARecordsAnonymized}`);
    console.log(`- Chat history records deleted: ${totalChatHistoryDeleted}`);
    
  } catch (error) {
    console.error('[CRITICAL ERROR] Fatal error in anonymization process:', error);
    
    // Attempt to send an alert through console for log monitoring systems
    console.error('========== GDPR ANONYMIZATION FAILURE ==========');
    console.error(`Time: ${new Date().toISOString()}`);
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    console.error('===============================================');
    
    throw error;
  } finally {
    // Always release the client back to the pool
    client.release();
  }
}

// Wrap the main function with proper error handling for Heroku
(async () => {
  try {
    await anonymizeOldQAData();
    
    // Properly exit on success
    if (process.env.NODE_ENV === 'production') {
      console.log('Exiting with success code');
      process.exit(0);
    }
  } catch (error) {
    console.error('Uncaught exception in anonymization script:', error);
    
    // Exit with error code
    if (process.env.NODE_ENV === 'production') {
      console.error('Exiting with error code');
      process.exit(1);
    }
  }
})();