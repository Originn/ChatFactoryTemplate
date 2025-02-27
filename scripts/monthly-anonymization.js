// scripts/monthly-anonymization.js

const { pool } = require('../db');

/**
 * Monthly scheduled function for anonymization of old QA data
 * This script should be scheduled to run once per month through a cron job
 */
async function anonymizeOldQAData() {
  console.log('Starting monthly data anonymization process...');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get all users with their retention settings
    const usersQuery = 'SELECT u.email, ps.retention_period FROM users u LEFT JOIN user_privacy_settings ps ON u.uid = ps.uid';
    const usersResult = await client.query(usersQuery);
    const users = usersResult.rows;
    
    console.log(`Processing ${users.length} users`);
    
    for (const user of users) {
      const { email, retention_period } = user;
      
      // Default to 1 month if no retention_period is set
      const retentionPeriod = retention_period || '1month';
      
      // Skip users with retention period set to 'forever'
      if (retentionPeriod === 'forever') {
        console.log(`Skipping user ${email} with retention period 'forever'`);
        continue;
      }
      
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
      
      console.log(`Processing user ${email} with retention period: ${interval}`);
      
      // Anonymize QA data older than retention period - FIXED nested REGEXP_REPLACE
      const anonymizeQuery = `
        UPDATE QuestionsAndAnswers 
        SET userEmail = 'anon-' || SUBSTR(MD5(userEmail), 1, 8),
            question = REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  question, 
                  '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b', 
                  '[EMAIL REDACTED]'
                ),
                '\\b\\d{10,16}\\b', 
                '[NUMBER REDACTED]'
              ),
              '\\b\\d{3}[- ]?\\d{2}[- ]?\\d{4}\\b', 
              '[SSN REDACTED]'
            )
        WHERE userEmail = $1 
        AND created_at < NOW() - INTERVAL '${interval}'
      `;
      
      const result = await client.query(anonymizeQuery, [email]);
      console.log(`Anonymized ${result.rowCount} QA records for user ${email}`);
      
      // Delete chat history older than retention period
      const deleteHistoryQuery = `
        DELETE FROM user_chat_history 
        WHERE useremail = $1 
        AND date < NOW() - INTERVAL '${interval}'
      `;
      
      const deleteResult = await client.query(deleteHistoryQuery, [email]);
      console.log(`Deleted ${deleteResult.rowCount} chat history records for user ${email}`);
    }
    
    await client.query('COMMIT');
    console.log('Monthly anonymization process completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during monthly anonymization process:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Self-executing function
(async () => {
  try {
    await anonymizeOldQAData();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error in anonymization process:', error);
    process.exit(1);
  }
})();