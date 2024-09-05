const { deleteOldChatHistory, pool } = require('../db');  // Adjust the import path as needed

async function main() {
  try {
    const deletedCount = await deleteOldChatHistory();
    console.log(`Successfully deleted ${deletedCount} old chat history entries`);
  } catch (error) {
    console.error('Error occurred while deleting old chat history:', error);
  } finally {
    await pool.end();  // Close the database connection
  }
}

main();