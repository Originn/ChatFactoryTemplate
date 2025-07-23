// utils/embeddingProviders.ts
// Simple Jina v4 embeddings with 512D

import { OpenAIEmbeddings } from '@langchain/openai';
import { CohereEmbeddings } from '@langchain/cohere';
import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf';
import { JinaEmbeddings } from '@langchain/community/embeddings/jina';
import { Embeddings } from '@langchain/core/embeddings';

export type EmbeddingProvider = 'openai' | 'cohere' | 'huggingface' | 'jina';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  apiKey?: string;
}

// Direct Jina API implementation with full parameter support
class DirectJinaEmbeddings extends Embeddings {
  private apiKey: string;
  private model: string;
  private dimensions: number;
  private task: string;

  constructor(config: {
    apiKey: string;
    model: string;
    dimensions: number;
    task: string;
  }) {
    super({});
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.dimensions = config.dimensions;
    this.task = config.task;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch('https://api.jina.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: texts,
          model: this.model,
          dimensions: this.dimensions,
          task: 'retrieval.passage', // For document indexing
        }),
      });

      if (!response.ok) {
        throw new Error(`Jina API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.data.map((item: any) => item.embedding);
    } catch (error) {
      console.error('Error in DirectJinaEmbeddings.embedDocuments:', error);
      throw error;
    }
  }

  async embedQuery(text: string): Promise<number[]> {
    try {
      console.log(`🔍 Calling Jina API directly: model=${this.model}, dimensions=${this.dimensions}, task=${this.task}`);
      
      const response = await fetch('https://api.jina.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: [text],
          model: this.model,
          dimensions: this.dimensions,
          task: this.task, // Use the configured task (retrieval.query)
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jina API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ Jina API call successful, received ${result.data[0].embedding.length}D embedding`);
      
      return result.data[0].embedding;
    } catch (error) {
      console.error('Error in DirectJinaEmbeddings.embedQuery:', error);
      throw error;
    }
  }
}

// Helper function to convert image URL to base64
export async function convertImageUrlToBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
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

// Interface for multimodal embedding result
export interface JinaMultimodalResult {
  embedding: number[];
  imageBase64Data: string[];
}

// Simple Jina multimodal embedding - 512D with base64 data return
export async function createJinaMultimodalEmbedding(
  text: string, 
  imageUrls: string[] = []
): Promise<number[]> {
  const result = await createJinaMultimodalEmbeddingWithBase64(text, imageUrls);
  return result.embedding;
}

// Enhanced Jina multimodal embedding - returns embedding + base64 data
export async function createJinaMultimodalEmbeddingWithBase64(
  text: string, 
  imageUrls: string[] = []
): Promise<JinaMultimodalResult> {
  if (!isJinaProvider()) {
    throw new Error('Jina provider not configured');
  }

  try {
    const input: any[] = [{ text }];
    const imageBase64Data: string[] = [];
    
    // Add images if provided
    if (imageUrls && imageUrls.length > 0) {
      for (const imageUrl of imageUrls) {
        const base64 = await convertImageUrlToBase64(imageUrl);
        input.push({ image: base64 });
        imageBase64Data.push(base64); // Store base64 for later use
      }
    }
    
    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`
      },
      body: JSON.stringify({
        model: 'jina-embeddings-v4',
        task: 'retrieval.query',
        dimensions: 512,
        input: input
      })
    });

    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      return {
        embedding: data.data[0].embedding,
        imageBase64Data
      };
    }
    
    throw new Error('No embedding returned from Jina API');
  } catch (error) {
    console.error('Error creating Jina multimodal embedding:', error);
    throw error;
  }
}

// Simple Jina image-only embedding - 512D
export async function createJinaImageOnlyEmbedding(
  imageUrls: string[]
): Promise<number[]> {
  if (!isJinaProvider()) {
    throw new Error('Jina provider not configured');
  }

  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('No image URLs provided for image-only embedding');
  }

  try {
    const input: any[] = [];
    
    // Add only images (no text)
    for (const imageUrl of imageUrls) {
      const base64 = await convertImageUrlToBase64(imageUrl);
      input.push({ image: base64 });
    }
    
    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`
      },
      body: JSON.stringify({
        model: 'jina-embeddings-v4',
        task: 'retrieval.query',
        dimensions: 512,
        input: input
      })
    });

    const data = await response.json();
    if (data.data && data.data.length > 0) {
      return data.data[0].embedding;
    }
    
    throw new Error('No embedding returned from Jina API');
  } catch (error) {
    console.error('Error creating image-only embedding:', error);
    throw error;
  }
}

// Simple Jina consistent embedding - 512D
export async function createJinaMultimodalEmbeddingConsistent(
  text: string, 
  imageUrls: string[] = []
): Promise<number[]> {
  if (!isJinaProvider()) {
    throw new Error('Jina provider not configured');
  }

  try {
    const input: any[] = [{ text }];
    
    // Use URLs directly
    if (imageUrls && imageUrls.length > 0) {
      for (const imageUrl of imageUrls) {
        input.push({ image: imageUrl });
      }
    }
    
    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`
      },
      body: JSON.stringify({
        model: 'jina-embeddings-v4',
        task: 'retrieval.query',
        dimensions: 512,
        input: input
      })
    });

    const data = await response.json();
    if (data.data && data.data.length > 0) {
      return data.data[0].embedding;
    }
    
    throw new Error('No embedding returned from Jina API');
  } catch (error) {
    console.error('Error creating consistent Jina multimodal embedding:', error);
    throw error;
  }
}

// Simple embedding model creation
export function createEmbeddingModel() {
  const provider = (process.env.EMBEDDING_PROVIDER || 'openai') as EmbeddingProvider;
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

  switch (provider) {
    case 'jina':
      // Use custom Jina implementation with direct API for full parameter support
      return new DirectJinaEmbeddings({
        apiKey: process.env.JINA_API_KEY || '',
        model: model,
        dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '512'),
        task: 'retrieval.query', // Full parameter support via direct API
      });

    case 'openai':
      return new OpenAIEmbeddings({
        modelName: model,
        dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536'),
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

// Simple config getter
export function getEmbeddingConfig(): EmbeddingConfig {
  const provider = (process.env.EMBEDDING_PROVIDER || 'openai') as EmbeddingProvider;
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  
  return {
    provider,
    model,
    dimensions: provider === 'jina' ? 512 : parseInt(process.env.EMBEDDING_DIMENSIONS || '1536')
  };
}

// Simple validation
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

// Simple dimensions getter
export function getModelDimensions(): number {
  const provider = (process.env.EMBEDDING_PROVIDER || 'openai') as EmbeddingProvider;
  
  return provider === 'jina' ? 512 : parseInt(process.env.EMBEDDING_DIMENSIONS || '1536');
}
