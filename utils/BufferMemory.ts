import { BaseChatMemory, MemoryVariables, InputValues } from "langchain/memory";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";

interface BufferMemoryInput {
  humanPrefix?: string;
  aiPrefix?: string;
  memoryKey?: string;
}

class BufferMemory extends BaseChatMemory implements BufferMemoryInput {
  humanPrefix: string;
  aiPrefix: string;
  memoryKey: string;
  metadata: Record<string, any>;
  messages: BaseMessage[];

  constructor(fields?: BufferMemoryInput) {
    super();
    this.humanPrefix = fields?.humanPrefix ?? 'Human';
    this.aiPrefix = fields?.aiPrefix ?? 'AI';
    this.memoryKey = fields?.memoryKey ?? 'chat_history';
    this.metadata = {};
    this.messages = [];
  }

  get memoryKeys(): string[] {
    return [this.memoryKey];
  }

  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    return {
      [this.memoryKey]: this.messages,
      ...this.metadata,
    };
  }
}

export default BufferMemory;