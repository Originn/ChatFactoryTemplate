// scripts/release-migration.cjs
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function runMigration() {
  try {
    console.log('Starting GDPR tables migration during Heroku release phase...');
    
    // Read the migration SQL file
    const sqlFilePath = path.join(__dirname, '..', 'scripts', 'gdpr_tables_migration.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL commands
    await pool.query(sqlContent);
    
    console.log('GDPR tables migration completed successfully!');
    
    // Close the pool to allow the process to exit
    await pool.end();
  } catch (error) {
    console.error('Migration failed:', error);
    console.error('Error details:', error.stack);
    
    // Try to close the pool even if there was an error
    try {
      await pool.end();
    } catch (err) {
      console.error('Error closing pool:', err);
    }
    
    // Exit with error code to make Heroku deployment fail if migrations fail
    // This prevents deploying code that relies on schema changes that failed to apply
    process.exit(1);
  }
}

// Run the migration and handle any uncaught errors
runMigration().catch(err => {
  console.error('Unhandled error in migration:', err);
  process.exit(1);
});