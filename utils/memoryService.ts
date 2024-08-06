import BufferMemory from "./BufferMemory";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";

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

  static async updateChatMemory(roomId: string, input: string, output: string, imageUrl: string[]): Promise<void> {
    const memory = this.getChatMemory(roomId);
    await memory.saveContext({ input }, { output });
    // Save the imageUrl in metadata if provided
    if (imageUrl) {
      memory.metadata.imageUrl = imageUrl;
    }
  }

  static clearChatMemory(roomId: string): void {
    delete this.chatMemory[roomId];
  }
}

export default MemoryService;
