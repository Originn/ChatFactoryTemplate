// BufferMemory.ts

import { BaseChatMemory, MemoryVariables, InputValues } from "langchain/memory";
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
  MessageType,
  MessageContent,
} from "@langchain/core/messages";

interface BufferMemoryInput {
  humanPrefix?: string;
  aiPrefix?: string;
  memoryKey?: string;
}

interface SerializedMessage {
  type: MessageType; // 'human', 'ai', 'system'
  content: string; // Changed to string
  additional_kwargs: Record<string, any>;
  response_metadata?: Record<string, any>;
}

class BufferMemory extends BaseChatMemory implements BufferMemoryInput {
  humanPrefix: string;
  aiPrefix: string;
  memoryKey: string;
  metadata: Record<string, any>;
  messages: BaseMessage[];

  constructor(fields?: BufferMemoryInput) {
    super();
    this.humanPrefix = fields?.humanPrefix ?? "Human";
    this.aiPrefix = fields?.aiPrefix ?? "AI";
    this.memoryKey = fields?.memoryKey ?? "chat_history";
    this.metadata = {};
    this.messages = [];
  }

  get memoryKeys(): string[] {
    return [this.memoryKey];
  }

  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    // Return messages directly if they haven't been serialized
    return {
      [this.memoryKey]: this.messages,
      ...this.metadata,
    };
  }

  // Serialization method
  serializeMessages(): SerializedMessage[] {
    return this.messages.map((message) => ({
      type: message._getType(), // 'human', 'ai', 'system'
      content: this.messageContentToString(message.content), // Convert content to string
      additional_kwargs: message.additional_kwargs,
      response_metadata: message.response_metadata,
    }));
  }

  // Helper method to convert MessageContent to string
  private messageContentToString(content: MessageContent): string {
    if (typeof content === 'string') {
      return content;
    } else if (Array.isArray(content)) {
      // If content is an array of MessageContentComplex
      return content.map((item) => item.type || '').join('');
    } else {
      // Handle other types if necessary
      return '';
    }
  }

  // Deserialization method
  deserializeMessages(serializedMessages: SerializedMessage[]): BaseMessage[] {
    return serializedMessages.map((serializedMessage) => {
      const { type, content, additional_kwargs, response_metadata } = serializedMessage;
      let message: BaseMessage;
      switch (type) {
        case "human":
          message = new HumanMessage(content, additional_kwargs);
          break;
        case "ai":
          message = new AIMessage(content, additional_kwargs);
          break;
        case "system":
          message = new SystemMessage(content, additional_kwargs);
          break;
        default:
          throw new Error(`Unknown message type: ${type}`);
      }
      message.response_metadata = response_metadata || {};
      return message;
    });
  }
}

export default BufferMemory;
