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
    console.log('Updating chat memory:', input, output, imageUrl);
    if (input) {
      const humanMessage = new HumanMessage(input);
      if (imageUrl && imageUrl.length > 0) {
        humanMessage.additional_kwargs = { imageUrls: imageUrl };
      }
      memory.messages.push(humanMessage);
    }
    if (output) {
      memory.messages.push(new AIMessage(output));
    }
  
    // Save the imageUrl in metadata if provided
    if (imageUrl && imageUrl.length > 0) {
      memory.metadata.imageUrl = imageUrl;
    }
    console.log('Updated chat memory:', memory);
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

  static async logMemoryState(roomId: string): Promise<void> {
    const memory = this.getChatMemory(roomId);
    console.log(`Memory state for room ${roomId}:`);
    console.log('Messages:', memory.messages);
    console.log('Metadata:', memory.metadata);
  }

  static loadFullConversationHistory(roomId: string, conversationHistory: any[]): void {
    const memory = this.getChatMemory(roomId);
    console.log('Loading full conversation history:', conversationHistory);
    
    // Keep track of all image URLs in the conversation
    const allImageUrls: string[] = [];
    
    memory.messages = conversationHistory.map(msg => {
      if (msg.type === 'userMessage') {
        const humanMessage = new HumanMessage(msg.message);
        // Add imageUrls to the message's additional_kwargs if present
        if (msg.imageUrls && msg.imageUrls.length > 0) {
          humanMessage.additional_kwargs = {
            imageUrls: msg.imageUrls
          };
          // Add these image URLs to our collection
          allImageUrls.push(...msg.imageUrls);
        }
        return humanMessage;
      } else {
        const aiMessage = new AIMessage(msg.message);
        // Preserve qaId and sourceDocs in additional_kwargs for AI messages
        aiMessage.additional_kwargs = {
          qaId: msg.qaId,
          sourceDocs: msg.sourceDocs || []
        };
        return aiMessage;
      }
    });

    // Update metadata with ALL image URLs from the conversation
    if (allImageUrls.length > 0) {
      memory.metadata = {
        ...memory.metadata,
        imageUrl: allImageUrls
      };
    } else {
      // Ensure imageUrl is cleared if there are no images
      memory.metadata = {
        ...memory.metadata,
        imageUrl: []
      };
    }
    
    console.log('Memory state after loading full conversation history:', memory);
  }
}

export default MemoryService;