// utils/embeddingProviders.ts
// Cohere embed-v4.0 embeddings with 512D Matryoshka

import { OpenAIEmbeddings } from '@langchain/openai';
import { CohereEmbeddings } from '@langchain/cohere';
import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf';
import { Embeddings } from '@langchain/core/embeddings';

export type EmbeddingProvider = 'openai' | 'cohere' | 'huggingface';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  apiKey?: string;
}

// Direct Cohere API implementation with dimensions support
class DirectCohereEmbeddings extends Embeddings {
  private apiKey: string;
  private model: string;
  private dimensions: number;
  private inputType: string;

  constructor(config: {
    apiKey: string;
    model: string;
    dimensions: number;
    inputType: string;
  }) {
    super({});
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.dimensions = config.dimensions;
    this.inputType = config.inputType;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch('https://api.cohere.com/v2/embed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: texts,
          model: this.model,
          embedding_types: ['float'],
          input_type: 'search_document',
          output_dimension: this.dimensions, // Matryoshka dimensions support
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cohere API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      return result.embeddings.float;
    } catch (error) {
      console.error('Error in DirectCohereEmbeddings.embedDocuments:', error);
      throw error;
    }
  }

  async embedQuery(text: string): Promise<number[]> {
    try {
      console.log(`🔍 Calling Cohere API directly: model=${this.model}, dimensions=${this.dimensions}, inputType=${this.inputType}`);

      const response = await fetch('https://api.cohere.com/v2/embed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: [text],
          model: this.model,
          embedding_types: ['float'],
          input_type: this.inputType,
          output_dimension: this.dimensions, // Matryoshka dimensions support
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cohere API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ Cohere API call successful, received ${result.embeddings.float[0].length}D embedding`);

      return result.embeddings.float[0];
    } catch (error) {
      console.error('Error in DirectCohereEmbeddings.embedQuery:', error);
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

// Helper function to check if provider is Cohere
export function isCohereProvider(): boolean {
  const provider = process.env.EMBEDDING_PROVIDER || 'cohere';
  return provider === 'cohere';
}

// Interface for multimodal embedding result
export interface CohereMultimodalResult {
  embedding: number[];
  imageBase64Data: string[];
}

// Cohere image-only embedding - 512D
// Note: Cohere v4 does NOT support text+image in one embedding, only text OR image
export async function createCohereImageOnlyEmbedding(
  imageUrls: string[]
): Promise<number[]> {
  if (!isCohereProvider()) {
    throw new Error('Cohere provider not configured');
  }

  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('No image URLs provided for image-only embedding');
  }

  try {
    // Convert images to base64 data URLs
    const imageDataUrls: string[] = [];

    for (const imageUrl of imageUrls) {
      const base64 = await convertImageUrlToBase64(imageUrl);
      // Cohere requires data URL format: data:image/jpeg;base64,{base64_string}
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      imageDataUrls.push(dataUrl);
    }

    const response = await fetch('https://api.cohere.com/v2/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.COHERE_API_KEY}`
      },
      body: JSON.stringify({
        model: 'embed-v4.0',
        input_type: 'image',
        embedding_types: ['float'],
        images: imageDataUrls,
        output_dimension: 512,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cohere API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    if (data.embeddings && data.embeddings.float && data.embeddings.float.length > 0) {
      // Return the first image's embedding
      return data.embeddings.float[0];
    }

    throw new Error('No embedding returned from Cohere API');
  } catch (error) {
    console.error('Error creating Cohere image-only embedding:', error);
    throw error;
  }
}

// Enhanced Cohere multimodal embedding with base64 data
// Note: For Cohere, this returns image embedding + base64 data since text+image combo not supported
export async function createCohereMultimodalEmbeddingWithBase64(
  text: string,
  imageUrls: string[] = []
): Promise<CohereMultimodalResult> {
  if (!isCohereProvider()) {
    throw new Error('Cohere provider not configured');
  }

  try {
    const imageBase64Data: string[] = [];
    let embedding: number[];

    // If images provided, use image embedding (Cohere doesn't support text+image combo)
    if (imageUrls && imageUrls.length > 0) {
      for (const imageUrl of imageUrls) {
        const base64 = await convertImageUrlToBase64(imageUrl);
        imageBase64Data.push(base64);
      }
      embedding = await createCohereImageOnlyEmbedding(imageUrls);
    } else {
      // Text-only embedding
      const embedder = new DirectCohereEmbeddings({
        apiKey: process.env.COHERE_API_KEY || '',
        model: 'embed-v4.0',
        dimensions: 512,
        inputType: 'search_query',
      });
      embedding = await embedder.embedQuery(text);
    }

    return {
      embedding,
      imageBase64Data
    };
  } catch (error) {
    console.error('Error creating Cohere multimodal embedding:', error);
    throw error;
  }
}

// Simple Cohere multimodal embedding wrapper
export async function createCohereMultimodalEmbedding(
  text: string,
  imageUrls: string[] = []
): Promise<number[]> {
  const result = await createCohereMultimodalEmbeddingWithBase64(text, imageUrls);
  return result.embedding;
}

// Simple embedding model creation
export function createEmbeddingModel() {
  const provider = (process.env.EMBEDDING_PROVIDER || 'cohere') as EmbeddingProvider;
  const model = process.env.EMBEDDING_MODEL || 'embed-v4.0';

  switch (provider) {
    case 'openai':
      return new OpenAIEmbeddings({
        modelName: model,
        dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536'),
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

    case 'cohere':
      // Use custom Cohere implementation with dimensions support
      return new DirectCohereEmbeddings({
        apiKey: process.env.COHERE_API_KEY || '',
        model: model,
        dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '512'),
        inputType: 'search_query',
      });

    case 'huggingface':
      return new HuggingFaceInferenceEmbeddings({
        apiKey: process.env.HUGGINGFACEHUB_API_KEY,
        model: model,
      });

    default:
      console.warn(`⚠️ Unknown embedding provider: ${provider}, falling back to Cohere`);
      return new DirectCohereEmbeddings({
        apiKey: process.env.COHERE_API_KEY || '',
        model: 'embed-v4.0',
        dimensions: 512,
        inputType: 'search_query',
      });
  }
}

// Simple config getter
export function getEmbeddingConfig(): EmbeddingConfig {
  const provider = (process.env.EMBEDDING_PROVIDER || 'cohere') as EmbeddingProvider;
  const model = process.env.EMBEDDING_MODEL || 'embed-v4.0';

  return {
    provider,
    model,
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '512')
  };
}

// Simple validation
export function validateEmbeddingConfig(): { isValid: boolean; error?: string } {
  const provider = process.env.EMBEDDING_PROVIDER || 'cohere';

  switch (provider) {
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
  return parseInt(process.env.EMBEDDING_DIMENSIONS || '512');
}
