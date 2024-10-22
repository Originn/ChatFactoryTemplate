import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { InputValues } from "langchain/memory";
import BufferMemory from "./BufferMemory";


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
    input: string,
    output: string,
    imageUrl: string[]
  ): Promise<void> {
    const memory = this.getChatMemory(roomId);  
    if (input) {
      memory.messages.push(new HumanMessage(input));
    }
    if (output) {
      memory.messages.push(new AIMessage(output));
    }
    if (imageUrl && imageUrl.length > 0) {
      memory.metadata.imageUrl = imageUrl;
    }
  }
  
  

  static async getChatHistory(roomId: string): Promise<BaseMessage[]> {
    const memory = this.getChatMemory(roomId);
    const result = await memory.loadMemoryVariables({} as InputValues);
    return result[memory.memoryKey] as BaseMessage[];
  }

  static clearChatMemory(roomId: string): void {
    const memory = this.getChatMemory(roomId);
    memory.messages = [];
    memory.metadata = {};
  }
  

  // New method to load a full conversation history
  static loadFullConversationHistory(roomId: string, conversationHistory: any[]): void {
    const memory = this.getChatMemory(roomId);
    memory.messages = conversationHistory.map(msg => 
      msg.type === 'userMessage' ? new HumanMessage(msg.message) : new AIMessage(msg.message)
    );
    // You may want to handle metadata (like imageUrls) here as well
  }
}


export default MemoryService;