import MemoryService from '@/utils/memoryService';

/**
 * Check if the given room has any chat history
 */
export async function isNewChatSession(roomId: string): Promise<boolean> {
  const chatHistory = await MemoryService.getChatHistory(roomId);
  return chatHistory.length === 0;
}

/**
 * Initialize chat history with a default greeting
 */
export async function initializeChatHistory(roomId: string, userEmail: string) {
  await MemoryService.updateChatMemory(roomId, 'Hi', null, null, userEmail);
}

/**
 * Ensure a chat session exists and initialize it if needed
 */
export async function ensureChatSession(roomId: string, userEmail: string) {
  if (await isNewChatSession(roomId)) {
    await initializeChatHistory(roomId, userEmail);
  }
}
