// Create a file called run-migration.js in your project root

const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function runMigration() {
  try {
    console.log('Starting GDPR tables migration...');
    
    // Read the migration SQL file
    const sqlFilePath = path.join(__dirname, 'scripts', 'gdpr_tables_migration.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL commands
    await pool.query(sqlContent);
    
    console.log('GDPR tables migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();