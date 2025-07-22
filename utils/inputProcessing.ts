import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import OpenAIChat from 'openai';
import MemoryService from '@/utils/memoryService';
import { isJinaProvider } from './embeddingProviders';
import {
  TRANSLATION_PROMPT,
  LANGUAGE_DETECTION_PROMPT,
  IMAGE_ANALYSIS_PROMPT,
  IMAGE_RELATION_PROMPT
} from './prompts/promptTemplates';

const IMAGE_MODEL_NAME = process.env.IMAGE_MODEL_NAME || 'gpt-4o-mini';

// Shared OpenAI client for image processing
const openai = new OpenAIChat();

// Cache for language detection results
const languageCache = new Map<string, string>();

export async function detectLanguageWithOpenAI(text: string, model: ChatOpenAI): Promise<string> {
  const cacheKey = text.substring(0, 100);
  if (languageCache.has(cacheKey)) {
    return languageCache.get(cacheKey) || 'English';
  }

  try {
    const prompt = LANGUAGE_DETECTION_PROMPT.replace('{text}', text);
    const message = { role: 'user', content: prompt };
    const response = await model.generate([[message]]);

    if (response.generations.length > 0 && response.generations[0].length > 0) {
      const language = response.generations[0][0].text.trim();
      languageCache.set(cacheKey, language);
      return language;
    }
  } catch (error) {
    console.error('Error detecting language:', error);
  }

  return 'English';
}

export async function translateToEnglish(text: string, model: ChatOpenAI): Promise<string> {
  try {
    const prompt = TRANSLATION_PROMPT.replace('{text}', text);
    const message = { role: 'user', content: prompt };
    const response = await model.generate([[message]]);

    if (response.generations.length > 0 && response.generations[0].length > 0) {
      return response.generations[0][0].text.trim();
    }
  } catch (error) {
    console.error('Error translating text:', error);
  }

  return text;
}

export async function processImageWithOpenAI(
  imageUrls: string[],
  query: string,
  modelName: string = IMAGE_MODEL_NAME
): Promise<string> {
  if (!imageUrls || imageUrls.length === 0) {
    return '';
  }

  try {
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: IMAGE_ANALYSIS_PROMPT
            }
          ]
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Question: ${query}` },
            ...imageUrls.map(url => ({
              type: 'image_url',
              image_url: { url }
            } as const))
          ]
        }
      ]
    });

    return response.choices[0]?.message?.content ?? 'No image description available';
  } catch (error) {
    console.error('Error processing images:', error);
    return 'Error processing image';
  }
}

export async function isQuestionRelatedToImage(
  followUpQuestion: string,
  chatHistory: (HumanMessage | AIMessage)[],
  model: ChatOpenAI,
  imageDescription: string
): Promise<boolean> {
  const formattedHistory = chatHistory
    .map(message => {
      const speaker = message instanceof HumanMessage ? 'User' : 'AI';
      const content = message.content || 'No message content';
      return `${speaker}: ${content}`;
    })
    .join('\n');

  const descriptionPart = imageDescription ? `Relevant Image Description:\n${imageDescription}\n` : '';

  const prompt = IMAGE_RELATION_PROMPT
    .replace('{chatHistory}', formattedHistory)
    .replace('{descriptionPart}', descriptionPart)
    .replace('{followUpQuestion}', followUpQuestion);

  try {
    const response = await model.generate([[{ role: 'user', content: prompt }]]);
    const answer = response.generations[0][0]?.text.trim().toLowerCase();
    return answer === 'yes';
  } catch (error) {
    console.error('Error determining if question is related to image:', error);
    return false;
  }
}

export async function getImageUrlsFromHistory(roomId: string): Promise<string[]> {
  try {
    const memory = await MemoryService.getChatHistory(roomId);
    const extractedImageUrls: string[] = [];

    for (const message of memory) {
      if (message?.additional_kwargs?.imageUrls) {
        const urls = Array.isArray(message.additional_kwargs.imageUrls)
          ? message.additional_kwargs.imageUrls
          : [message.additional_kwargs.imageUrls];
        extractedImageUrls.push(...urls);
      }
    }

    return Array.from(new Set(extractedImageUrls));
  } catch (error) {
    console.error('Error extracting image URLs from history:', error);
    return [];
  }
}

export async function prepareInput(
  input: string,
  imageUrls: string[],
  roomId: string,
  sharedModel: ChatOpenAI,
  translationModel: ChatOpenAI
): Promise<{
  processedInput: string;
  originalInput: string;
  language: string;
  imageDescription: string;
}> {
  let processedInput = input;
  let imageDescription = '';

  // Skip OpenAI image processing if using Jina multimodal embeddings
  if (imageUrls && imageUrls.length > 0 && !isJinaProvider()) {
    // Only process images with OpenAI if NOT using Jina
    imageDescription = await processImageWithOpenAI(imageUrls, input);
  }

  const language = await detectLanguageWithOpenAI(processedInput, sharedModel);
  const originalInput = processedInput;

  if (language !== 'English') {
    processedInput = await translateToEnglish(processedInput, translationModel);
  }

  // Only append image description if we're not using Jina (since Jina handles images directly)
  if (imageDescription && !isJinaProvider()) {
    processedInput = `${processedInput} [Image model answer: ${imageDescription}]`;
  }

  // Handle historical images only if NOT using Jina
  if (imageUrls.length === 0 && !isJinaProvider()) {
    const historyImageUrls = await getImageUrlsFromHistory(roomId);
    if (historyImageUrls.length > 0) {
      const relatedToImage = await isQuestionRelatedToImage(
        processedInput,
        await MemoryService.getChatHistory(roomId),
        sharedModel,
        imageDescription
      );

      if (relatedToImage) {
        const historicalImageDescription = await processImageWithOpenAI(
          historyImageUrls,
          processedInput
        );

        if (historicalImageDescription) {
          processedInput = `${processedInput} [Image model answer: ${historicalImageDescription}]`;
          imageDescription = historicalImageDescription;
        }
      }
    }
  }

  return {
    processedInput,
    originalInput,
    language,
    imageDescription
  };
}

// Utility function to convert storage URLs to signed URLs if needed  
export async function convertToSignedUrlIfNeeded(imageUrl: string): Promise<string> {
  try {
    // Check if it's a storage.googleapis.com URL that needs signing
    if (imageUrl.includes('storage.googleapis.com')) {
      
      // Extract bucket name and filename from URL
      const urlParts = imageUrl.replace('https://storage.googleapis.com/', '').split('/');
      const bucketName = urlParts[0];
      const fileName = urlParts.slice(1).join('/');
      
      if (!fileName) {
        console.warn('Could not extract filename from URL:', imageUrl);
        return imageUrl;
      }

      console.log(`🔗 Converting storage URL to signed URL - Bucket: ${bucketName}, File: ${fileName}`);

      // Check if Firebase credentials are available
      if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        console.log(`⚠️ No Firebase credentials configured. Skipping signed URL generation.`);
        return imageUrl;
      }

      // Server-side signed URL generation using Firebase credentials
      const { Storage } = await import('@google-cloud/storage');
      
      // Format the private key properly (handle escaped newlines)
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      const storage = new Storage({
        projectId: process.env.FIREBASE_PROJECT_ID,
        credentials: {
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          private_key: privateKey,
        },
      });
      
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(fileName);

      // Check if file exists first
      const [exists] = await file.exists();
      if (!exists) {
        console.warn(`⚠️ File does not exist: ${fileName} in bucket ${bucketName}`);
        return imageUrl; // Fallback to original URL
      }

      // Generate new 7-day signed URL
      const options = {
        version: 'v4' as const,
        action: 'read' as const,
        expires: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      };

      const [signedUrl] = await file.getSignedUrl(options);
      console.log(`✅ Generated signed URL for ${fileName} using Firebase credentials`);
      return signedUrl;
    }
    
    return imageUrl; // Non-storage URLs can be used directly
  } catch (error) {
    console.error('Error converting URL to signed URL:', error);
    console.error('Original URL:', imageUrl);
    return imageUrl; // Fallback to original URL
  }
}
