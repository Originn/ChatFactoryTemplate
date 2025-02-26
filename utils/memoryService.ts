// MemoryService.ts

import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import BufferMemory from "./BufferMemory";
import { insertChatHistory, getChatHistoryByRoomId, getTitleByRoomId } from '../db';
import { Message } from '@/types/chat';


class MemoryService {
  private static chatMemory: Record<string, BufferMemory> = {};

  static getChatMemory(roomId: string): BufferMemory {
    if (!this.chatMemory[roomId]) {
      this.chatMemory[roomId] = new BufferMemory({
        memoryKey: "chat_history",
      });
    }
    return this.chatMemory[roomId];
  }

  static async updateChatMemory(
    roomId: string,
    input: string | null,
    output: string | null,
    imageUrl: string[] | null,
    userEmail: string | null,
    sourceDocs: any[] | null = null,
    qaId: string | null = null,
    conversationTitle: string = ''
  ): Promise<void> {
    // Retrieve existing chat history from the database
    let chatHistoryRecord = await getChatHistoryByRoomId(roomId);
  
    // Fetch the title by roomId and extract the conversation_title property
    let titleRecord = await getTitleByRoomId(roomId);
    let title = titleRecord?.conversation_title || ''; // Extract the conversation_title or default to an empty string
  
    // Use conversationTitle if title is empty or undefined
    title = title.trim() || conversationTitle.trim();
  
    // Ensure a fallback to a default if both are empty
    if (!title) {
      title = conversationTitle.trim();
    }
  
    let messages: Message[] = [];
    if (chatHistoryRecord && chatHistoryRecord.conversation_json) {
      // Filter out the initial "Hi" message from existing messages
      messages = chatHistoryRecord.conversation_json.filter(
        (msg: Message) => !(msg.type === 'userMessage' && msg.message === 'Hi')
      );
    }
  
    // Process input message
    if (input) {
      const humanMessage: Message = {
        type: 'userMessage',
        message: input,
        isComplete: true,
      };
      if (imageUrl && imageUrl.length > 0) {
        humanMessage.imageUrls = imageUrl;
      }
      messages.push(humanMessage);
    }
  
    // Process output message
    if (output) {
      const aiMessage: Message = {
        qaId: qaId || undefined,
        type: 'apiMessage',
        message: output,
        isComplete: true,
        sourceDocs: sourceDocs || undefined,
      };
      messages.push(aiMessage);
    }
  
    // Update chat history in the database with the validated title
    await insertChatHistory(userEmail, title, roomId, messages);
  }
  
  
  
  static async getHasProcessedImage(roomId: string): Promise<boolean> {
    // Retrieve chat history record from the database
    const chatHistoryRecord = await getChatHistoryByRoomId(roomId);
  
    // Check if any userMessage in conversation_json has non-empty imageUrls
    if (chatHistoryRecord && Array.isArray(chatHistoryRecord.conversation_json)) {
      return chatHistoryRecord.conversation_json.some((msg: any) => 
        msg.type === 'userMessage' && msg.imageUrls && msg.imageUrls.length > 0
      );
    }
  
    // Default to false if no such message with imageUrls is found
    return false;
  }

  static async getChatHistory(roomId: string): Promise<BaseMessage[]> {
    const chatHistoryRecord = await getChatHistoryByRoomId(roomId);
  
    if (!chatHistoryRecord || !chatHistoryRecord.conversation_json) {
      return [];
    }
  
    const messages: Message[] = chatHistoryRecord.conversation_json;
  
    // Convert stored messages to BaseMessage objects
    const baseMessages: BaseMessage[] = messages.map((msg) => {
      if (msg.type === 'userMessage') {
        const humanMessage = new HumanMessage(msg.message);
        if (msg.imageUrls && msg.imageUrls.length > 0) {
          humanMessage.additional_kwargs = { imageUrls: msg.imageUrls };
        }
        return humanMessage;
      } else if (msg.type === 'apiMessage') {
        const aiMessage = new AIMessage(msg.message);
        aiMessage.additional_kwargs = {
          qaId: msg.qaId,
          sourceDocs: msg.sourceDocs || [],
        };
        return aiMessage;
      } else {
        throw new Error(`Unknown message type: ${msg.type}`);
      }
    });
  
    return baseMessages;
  }
  

  static clearChatMemory(roomId: string): void {
    const memory = this.getChatMemory(roomId);
    memory.messages = [];
    memory.metadata = {};
  }

  static loadFullConversationHistory(roomId: string, conversationHistory: any[]): void {
    const memory = this.getChatMemory(roomId);
  
    // Keep track of all image URLs in the conversation
    const allImageUrls: string[] = [];
  
    memory.messages = conversationHistory.map((msg) => {
      if (msg.type === "userMessage") {
        const humanMessage = new HumanMessage(msg.message);
        if (msg.imageUrls && msg.imageUrls.length > 0) {
          humanMessage.additional_kwargs = {
            imageUrls: msg.imageUrls,
          };
          allImageUrls.push(...msg.imageUrls);
        }
        return humanMessage;
      } else if (msg.type === "apiMessage") {
        const aiMessage = new AIMessage(msg.message);
        aiMessage.additional_kwargs = {
          qaId: msg.qaId,
          sourceDocs: msg.sourceDocs || [],
        };
        return aiMessage;
      } else {
        // Throw an error for unknown message types
        throw new Error(`Unknown message type: ${msg.type}`);
      }
    });
  
    // Update metadata with ALL image URLs from the conversation
    memory.metadata = {
      ...memory.metadata,
      imageUrl: allImageUrls.length > 0 ? allImageUrls : [],
      hasProcessedImage: allImageUrls.length > 0,
    };
  }
}

export default MemoryService;
