import { ChatOpenAI } from '@langchain/openai';

interface ModelParams {
  streaming?: boolean;
  verbose?: boolean;
  callbacks?: any[];
  maxTokens?: number;
  apiKey?: string;
}

/**
 * Creates a chat model (OpenAI only)
 */
export function createChatModel(
  provider: string = 'openai',
  params: ModelParams
): ChatOpenAI {
  return createOpenAIModel(params);
}

/**
 * Creates an OpenAI chat model with the provided parameters
 */
function createOpenAIModel(params: ModelParams): ChatOpenAI {
  const { streaming = false, callbacks = [], verbose = false, maxTokens, apiKey } = params;
  
  return new ChatOpenAI({
    streaming,
    modelName: process.env.MODEL_NAME || 'gpt-4.1',
    verbose,
    temperature: parseFloat(process.env.TEMPERATURE || '0'),
    maxTokens,
    modelKwargs: { seed: 1 },
    callbacks,
    openAIApiKey: apiKey,
  });
}