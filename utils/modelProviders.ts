import { ChatOpenAI } from '@langchain/openai';
import { ChatDeepSeek } from '@langchain/deepseek';
import { BaseMessage } from '@langchain/core/messages';
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
      const currentType = message instanceof BaseMessage ? message.constructor.name : 'Unknown';
      
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
function createDeepSeekModel(params: ModelParams): ChatDeepSeek {
  const { streaming = false, callbacks = [], verbose = false, maxTokens, apiKey } = params;
  
  const model = new ChatDeepSeek({
    streaming,
    model: 'deepseek-reasoner', // Using DeepSeek-R1 reasoning model
    maxTokens,
    callbacks,
    temperature: 0,
    apiKey: apiKey || process.env.DEEPSEEK_API_KEY,
  });

  // Override the generate method to ensure proper message formatting
  const originalGenerate = model.generate.bind(model);
  model.generate = async function(messages, options, callbacks) {
    const processedMessages = preprocessMessages(messages);
    return originalGenerate(processedMessages, options, callbacks);
  };
  
  return model;
}