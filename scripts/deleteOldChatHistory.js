const { deleteOldChatHistory } = require('../db');

async function run() {
  try {
    const deletedCount = await deleteOldChatHistory();
    console.log(`Deleted ${deletedCount} old chat history entries`);
  } catch (error) {
    console.error('Error deleting old chat history:', error);
  }
}

run();