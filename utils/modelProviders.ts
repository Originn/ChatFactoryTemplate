import { ChatOpenAI } from '@langchain/openai';
import { ChatDeepSeek } from '@langchain/deepseek';
import { BaseMessageLike } from '@langchain/core/messages';

interface ModelParams {
  streaming?: boolean;
  verbose?: boolean;
  callbacks?: any[];
  maxTokens?: number;
  apiKey?: string;
}

/**
 * Creates a chat model based on the specified provider
 */
export function createChatModel(
  provider: string,
  params: ModelParams
): ChatOpenAI | ChatDeepSeek {
  switch (provider) {
    case 'deepseek':
      return createDeepSeekModel(params);
    case 'openai':
    default:
      return createOpenAIModel(params);
  }
}

/**
 * Creates an OpenAI chat model with the provided parameters
 */
function createOpenAIModel(params: ModelParams): ChatOpenAI {
  const { streaming = false, callbacks = [], verbose = false, maxTokens, apiKey } = params;
  
  return new ChatOpenAI({
    streaming,
    modelName: process.env.MODEL_NAME || 'gpt-4o',
    verbose,
    temperature: parseFloat(process.env.TEMPERATURE || '0'),
    maxTokens,
    modelKwargs: { seed: 1 },
    callbacks,
    openAIApiKey: apiKey,
  });
}

/**
 * Preprocesses messages to ensure they alternate between user and assistant
 * This is required for DeepSeek, which doesn't support consecutive messages of the same type
 */
function preprocessMessages(messages: BaseMessageLike[][]): BaseMessageLike[][] {
  return messages.map(messageArray => {
    if (messageArray.length <= 1) return messageArray;
    
    const processedArray: BaseMessageLike[] = [];
    let lastType = '';
    
    for (const message of messageArray) {
      // Skip if it's a string (should be converted to a message by the model)
      if (typeof message === 'string') {
        processedArray.push(message);
        continue;
      }
      
      // For actual message objects
      const currentType = typeof message === 'object' && message !== null 
        ? (message as any).constructor.name 
        : 'Unknown';
      
      if (lastType !== currentType || processedArray.length === 0) {
        processedArray.push(message);
        lastType = currentType;
      } else {
        // Same type as previous, replace the last message
        processedArray[processedArray.length - 1] = message;
      }
    }
    
    return processedArray;
  });
}

/**
 * Creates a DeepSeek chat model with the provided parameters
 */
/**
 * Creates a DeepSeek chat model with the provided parameters
 */
function createDeepSeekModel(params: ModelParams): ChatDeepSeek {
    const { streaming = false, callbacks = [], verbose = false, maxTokens, apiKey } = params;
    
    // Create the DeepSeek model with standard options
    const model = new ChatDeepSeek({
      streaming,
      model: 'deepseek-reasoner',
      maxTokens,
      callbacks,
      temperature: 0,
      apiKey: apiKey || process.env.DEEPSEEK_API_KEY,
      timeout: 30000 // 30 seconds
    });
  
    // Override token counting to avoid errors
    // @ts-ignore - accessing protected methods
    model.getNumTokens = async (text: string): Promise<number> => {
      // Simple approximation: ~1 token per 4 characters
      return Math.ceil(text.length / 4);
    };
  
    // @ts-ignore - accessing protected methods
    model.getNumTokensFromMessages = async (messages: any[]): Promise<number> => {
      let totalTokens = 0;
      for (const message of messages) {
        if (typeof message === 'string') {
          totalTokens += Math.ceil(message.length / 4);
        } else if (message?.content) {
          const content = typeof message.content === 'string' 
            ? message.content 
            : JSON.stringify(message.content);
          totalTokens += Math.ceil(content.length / 4);
        }
      }
      return totalTokens;
    };
  
    // Override the generate method to ensure proper message formatting
    const originalGenerate = model.generate.bind(model);
    model.generate = async function(messages, options, callbacks) {
      try {
        const processedMessages = preprocessMessages(messages);
        return await originalGenerate(processedMessages, options, callbacks);
      } catch (error:any) {
        console.error("DeepSeek generate error:", error);
        
        // If the error is about message format, try with even more aggressive processing
        if (error.message && typeof error.message === 'string' && 
            error.message.includes("does not support successive")) {
          
          // Keep only one message of each type (system, human, assistant)
          const simplifiedMessages = messages.map(msgArray => {
            // Extract type-specific messages
            const systemMsg = msgArray.find(m => typeof m === 'object' && 
              (m as any)?.constructor?.name === 'SystemMessage');
            
            const humanMsg = [...msgArray]
              .reverse()
              .find(m => typeof m === 'object' && 
                (m as any)?.constructor?.name === 'HumanMessage');
            
            const assistantMsg = [...msgArray]
              .reverse()
              .find(m => typeof m === 'object' && 
                (m as any)?.constructor?.name === 'AIMessage');
            
            // Build a clean array with proper alternation
            const result = [];
            if (systemMsg) result.push(systemMsg);
            if (humanMsg) result.push(humanMsg);
            if (assistantMsg) result.push(assistantMsg);
            
            return result;
          });
          
          return await originalGenerate(simplifiedMessages, options, callbacks);
        }
        
        throw error;
      }
    };
    
    return model;
  }