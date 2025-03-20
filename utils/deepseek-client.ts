import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatGeneration, ChatResult } from '@langchain/core/outputs';
import OpenAI from 'openai';

interface DeepSeekModelParams {
  apiKey?: string;
  modelName?: string;
  temperature?: number;
  streaming?: boolean;
  maxTokens?: number;
  callbacks?: any[];
  verbose?: boolean;
}

// Implementation of DeepSeek client for LangChain, using OpenAI's SDK with DeepSeek's API
export class DeepSeekChatModel extends BaseChatModel {
  private client: OpenAI;
  apiKey: string;
  modelName: string;
  temperature: number = 0;
  streaming: boolean = false;
  maxTokens?: number;
  callbacks?: any[];
  verbose: boolean = false;
  constructor(params: DeepSeekModelParams) {
    super(params);
    this.apiKey = params.apiKey || process.env.DEEPSEEK_API_KEY || '';
    this.modelName = params.modelName || 'deepseek-reasoner';  // Using DeepSeek-R1 reasoning model by default
    this.temperature = params.temperature ?? 0;
    this.streaming = params.streaming ?? false;
    this.maxTokens = params.maxTokens;
    this.callbacks = params.callbacks;
    this.verbose = params.verbose ?? false;
    
    if (!this.apiKey) {
      throw new Error("DeepSeek API key is required");
    }

    // Initialize the OpenAI client with DeepSeek's base URL
    this.client = new OpenAI({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: this.apiKey,
    });
  }

  _llmType(): string {
    return "deepseek";
  }

  /** @ignore */
  _combineLLMOutput() {
    return {};
  }

  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const formattedMessages = this.prepareFinalMessages(messages);
    
    try {
      if (this.streaming && runManager) {
        return await this.callWithStreaming(formattedMessages, runManager);
      } else {
        return await this.callWithoutStreaming(formattedMessages);
      }
    } catch (error) {
      console.error("Error generating with DeepSeek:", error);
      throw error;
    }
  }

  private prepareFinalMessages(messages: BaseMessage[]): Array<OpenAI.ChatCompletionMessageParam> {
    return messages.map(message => {
      if (message instanceof SystemMessage) {
        return { role: "system", content: message.content as string };
      } else if (message instanceof HumanMessage) {
        return { role: "user", content: message.content as string };
      } else if (message instanceof AIMessage) {
        return { role: "assistant", content: message.content as string };
      } else {
        return { role: "user", content: message.content.toString() };
      }
    });
  }

  private async callWithoutStreaming(
    messages: Array<OpenAI.ChatCompletionMessageParam>
  ): Promise<ChatResult> {
    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    });
    
    const content = response.choices[0]?.message?.content || '';
    const message = new AIMessage(content);
    
    return {
      generations: [
        {
          text: content,
          message: message,
        },
      ],
      llmOutput: { 
        tokenUsage: {
          completionTokens: response.usage?.completion_tokens,
          promptTokens: response.usage?.prompt_tokens,
          totalTokens: response.usage?.total_tokens
        } 
      },
    };
  }

  private async callWithStreaming(
    messages: Array<OpenAI.ChatCompletionMessageParam>,
    runManager: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const stream = await this.client.chat.completions.create({
      model: this.modelName,
      messages: messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: true,
    });
    
    let text = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        text += content;
        await runManager.handleLLMNewToken(content);
      }
    }
    
    const message = new AIMessage(text);
    
    return {
      generations: [
        {
          text,
          message,
        },
      ],
      llmOutput: {},
    };
  }
}

export function createDeepSeekModel(params: DeepSeekModelParams): BaseChatModel {
  return new DeepSeekChatModel(params);
}
