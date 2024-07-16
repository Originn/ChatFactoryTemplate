import { BufferMemory } from "langchain/memory";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";

interface ChatMessage {
  role: string;
  content: string;
}

class MemoryService {
  private static chatMemory: Record<string, ChatMessage[]> = {};

  static getChatMemory(roomId: string): BufferMemory {
    if (!this.chatMemory[roomId]) {
      this.chatMemory[roomId] = [];
    }

    const memory = new BufferMemory({
      memoryKey: "chat_history",
      inputKey: "question",  // Specify the input key
      outputKey: "text", // Specify the output key
      returnMessages: true,
    });

    // Populate memory with stored messages
    const chatHistory = this.chatMemory[roomId].map(msg => 
      msg.role === 'Human' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
    );
    (memory as any).chatHistory.messages = chatHistory;

    this.logChatMemory(roomId);
    return memory;
  }

  static updateChatMemory(roomId: string, memory: BufferMemory): void {
    const chatHistory = (memory as any).chatHistory.messages;
    this.chatMemory[roomId] = chatHistory.map((msg: BaseMessage) => ({
      role: msg._getType(),
      content: msg.content,
    }));
    this.logChatMemory(roomId);
  }

  static clearChatMemory(roomId: string): void {
    delete this.chatMemory[roomId];
  }

  static logChatMemory(roomId: string): void {
    console.log(`Chat Memory for roomId: ${roomId}`);
    if (this.chatMemory[roomId]) {
      console.log("Chat History:");
      this.chatMemory[roomId].forEach((message, index) => {
        console.log(`${index + 1}: ${message.role} - ${message.content}`);
      });
    } else {
      console.log("No messages in chat history.");
    }
  }
}

export default MemoryService;
