// utils/embeddingProviders.ts
// This utility creates embedding models dynamically based on environment variables

import { OpenAIEmbeddings } from '@langchain/openai';
import { CohereEmbeddings } from '@langchain/cohere';
import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf';
import { JinaEmbeddings } from '@langchain/community/embeddings/jina';

export type EmbeddingProvider = 'openai' | 'cohere' | 'huggingface' | 'jina';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  apiKey?: string;
}

// Helper function to convert image URL to base64
export async function convertImageUrlToBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return base64;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
}

// Helper function to check if provider is Jina
export function isJinaProvider(): boolean {
  const provider = process.env.EMBEDDING_PROVIDER || 'openai';
  return provider === 'jina';
}

// Custom Jina multimodal embedding function
export async function createJinaMultimodalEmbedding(
  text: string, 
  imageUrls: string[] = []
): Promise<number[]> {
  if (!isJinaProvider()) {
    throw new Error('Jina provider not configured');
  }

  try {
    const input: any[] = [{ text }];
    
    // Add images if provided
    if (imageUrls && imageUrls.length > 0) {
      for (const imageUrl of imageUrls) {
        const base64 = await convertImageUrlToBase64(imageUrl);
        input.push({ image: base64 });
      }
    }

    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.EMBEDDING_MODEL || 'jina-embeddings-v4',
        task: 'retrieval.query',
        input: input
      })
    });

    const data = await response.json();
    if (data.data && data.data.length > 0) {
      return data.data[0].embedding;
    }
    
    throw new Error('No embedding returned from Jina API');
  } catch (error) {
    console.error('Error creating Jina multimodal embedding:', error);
    throw error;
  }
}

/**
 * Creates an embedding model instance based on environment variables
 * @returns Configured embedding model instance
 */
export function createEmbeddingModel() {
  const provider = (process.env.EMBEDDING_PROVIDER || 'openai') as EmbeddingProvider;
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536');

  console.log(`🔧 Creating embedding model: ${provider}/${model} (${dimensions}D)`);
  console.error(`🚨 DEBUG: Creating embedding model: ${provider}/${model} (${dimensions}D)`);
  console.error(`🚨 DEBUG: ENV VARS - PROVIDER: ${process.env.EMBEDDING_PROVIDER}, MODEL: ${process.env.EMBEDDING_MODEL}, DIMENSIONS: ${process.env.EMBEDDING_DIMENSIONS}`);

  switch (provider) {
    case 'jina':
      return new JinaEmbeddings({
        apiKey: process.env.JINA_API_KEY,
        model: model,
        dimensions: dimensions,  // ✅ Add dimensions parameter
      });

    case 'openai':
      return new OpenAIEmbeddings({
        modelName: model,
        dimensions: dimensions,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

    case 'cohere':
      return new CohereEmbeddings({
        apiKey: process.env.COHERE_API_KEY,
        model: model,
      });

    case 'huggingface':
      return new HuggingFaceInferenceEmbeddings({
        apiKey: process.env.HUGGINGFACEHUB_API_KEY,
        model: model,
      });

    default:
      console.warn(`⚠️ Unknown embedding provider: ${provider}, falling back to OpenAI`);
      return new OpenAIEmbeddings({
        modelName: 'text-embedding-3-small',
        dimensions: 1536,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
  }
}

/**
 * Get embedding configuration from environment variables
 * @returns Current embedding configuration
 */
export function getEmbeddingConfig(): EmbeddingConfig {
  return {
    provider: (process.env.EMBEDDING_PROVIDER || 'openai') as EmbeddingProvider,
    model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536'),
  };
}

/**
 * Validates that required API keys are present for the selected provider
 * @returns Validation result
 */
export function validateEmbeddingConfig(): { isValid: boolean; error?: string } {
  const provider = process.env.EMBEDDING_PROVIDER || 'openai';
  
  switch (provider) {
    case 'jina':
      if (!process.env.JINA_API_KEY) {
        return { isValid: false, error: 'JINA_API_KEY is required for Jina embeddings' };
      }
      break;
    case 'openai':
      if (!process.env.OPENAI_API_KEY) {
        return { isValid: false, error: 'OPENAI_API_KEY is required for OpenAI embeddings' };
      }
      break;
    case 'cohere':
      if (!process.env.COHERE_API_KEY) {
        return { isValid: false, error: 'COHERE_API_KEY is required for Cohere embeddings' };
      }
      break;
    case 'huggingface':
      if (!process.env.HUGGINGFACEHUB_API_KEY) {
        return { isValid: false, error: 'HUGGINGFACEHUB_API_KEY is required for HuggingFace embeddings' };
      }
      break;
    default:
      return { isValid: false, error: `Unknown embedding provider: ${provider}` };
  }

  return { isValid: true };
}

/**
 * Get model dimensions from environment variables
 * ALWAYS uses EMBEDDING_DIMENSIONS env var - no hardcoded values
 * @returns Model dimensions from environment configuration
 */
export function getModelDimensions(): number {
  const dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536');
  console.log(`🔧 Using dimensions from env: ${dimensions}D`);
  return dimensions;
}
