// Tenant database wrapper - auto-injects chatbot_id
const { 
  insertQA, 
  updateFeedback,
  insertQuestionEmbedderDetails,
  insertChatHistory, 
  getChatHistoryByRoomId, 
  getUserPrivacySettings,
  updateUserPrivacySettings,
  getUserAIProvider,
  getAPIKeyForProvider,
} = require('../db');

class TenantDB {
  constructor() {
    this.chatbotId = process.env.CHATBOT_ID || 'dev-fallback';
    
    if (!process.env.CHATBOT_ID) {
      console.warn('⚠️ CHATBOT_ID not set - using fallback');
    }
  }

  // Database methods with automatic chatbot_id injection
  async insertQA(...args) {
    return insertQA(this.chatbotId, ...args);
  }

  async updateFeedback(...args) {
    return updateFeedback(this.chatbotId, ...args);
  }

  async insertQuestionEmbedderDetails(...args) {
    return insertQuestionEmbedderDetails(this.chatbotId, ...args);
  }

  async insertChatHistory(...args) {
    return insertChatHistory(this.chatbotId, ...args);
  }

  async getChatHistoryByRoomId(...args) {
    return getChatHistoryByRoomId(this.chatbotId, ...args);
  }

  async getUserPrivacySettings(...args) {
    return getUserPrivacySettings(this.chatbotId, ...args);
  }

  async updateUserPrivacySettings(...args) {
    return updateUserPrivacySettings(this.chatbotId, ...args);
  }

  // Global methods (no chatbot_id needed)
  async getUserAIProvider(...args) {
    return getUserAIProvider(...args);
  }

  async getAPIKeyForProvider(...args) {
    return getAPIKeyForProvider(...args);
  }
}

module.exports = TenantDB;
