import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import OpenAIChat from 'openai';
import MemoryService from '@/utils/memoryService';
import { isJinaProvider } from './embeddingProviders';
import {
  IMAGE_ANALYSIS_PROMPT,
  IMAGE_RELATION_PROMPT,
  CONSOLIDATED_INPUT_PROCESSING_PROMPT
} from './prompts/promptTemplates';

const IMAGE_MODEL_NAME = process.env.IMAGE_MODEL_NAME || 'gpt-4o-mini';

// Shared OpenAI client for image processing
const openai = new OpenAIChat();

export async function processInputConsolidated(
  userQuestion: string,
  chatHistory: (HumanMessage | AIMessage)[],
  isFirstMessage: boolean,
  model: ChatOpenAI
): Promise<{
  detectedLanguage: string;
  translatedQuestion: string;
  contextualizedQuestion: string;
  conversationTitle: string | null;
}> {
  try {
    // Format chat history for the prompt
    const formattedHistory = chatHistory
      .map(message => {
        const speaker = message instanceof HumanMessage ? 'User' : 'AI';
        const content = message.content || 'No message content';
        return `${speaker}: ${content}`;
      })
      .join('\n');

    // Create the consolidated prompt
    const prompt = CONSOLIDATED_INPUT_PROCESSING_PROMPT
      .replace('{userQuestion}', userQuestion)
      .replace('{chatHistory}', formattedHistory || 'No previous chat history')
      .replace('{isFirstMessage}', isFirstMessage.toString());

    const message = { role: 'user', content: prompt };
    const response = await model.generate([[message]]);

    if (response.generations.length > 0 && response.generations[0].length > 0) {
      const responseText = response.generations[0][0].text.trim();
      
      try {
        const parsedResponse = JSON.parse(responseText);
        
        return {
          detectedLanguage: parsedResponse.detectedLanguage || 'English',
          translatedQuestion: parsedResponse.translatedQuestion || userQuestion,
          contextualizedQuestion: parsedResponse.contextualizedQuestion || userQuestion,
          conversationTitle: parsedResponse.conversationTitle
        };
      } catch (parseError) {
        console.error('Error parsing JSON response from consolidated prompt:', parseError);
        console.error('Response text:', responseText);
        // Fall back to default values if JSON parsing fails
        return {
          detectedLanguage: 'English',
          translatedQuestion: userQuestion,
          contextualizedQuestion: userQuestion,
          conversationTitle: null
        };
      }
    }
  } catch (error) {
    console.error('Error in consolidated input processing:', error);
    // Fall back to default values
    return {
      detectedLanguage: 'English',
      translatedQuestion: userQuestion,
      contextualizedQuestion: userQuestion,
      conversationTitle: null
    };
  }

  // Default fallback
  return {
    detectedLanguage: 'English',
    translatedQuestion: userQuestion,
    contextualizedQuestion: userQuestion,
    conversationTitle: null
  };
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

// Enhanced vision processing with multiple context images and user images (streaming version)
export async function processImagesWithContextStreaming(
  userImageBase64Data: string[],
  contextImageUrls: string[],
  userQuery: string,
  onTokenCallback: (token: string) => void
): Promise<string> {
  if ((!userImageBase64Data || userImageBase64Data.length === 0) && 
      (!contextImageUrls || contextImageUrls.length === 0)) {
    return '';
  }

  try {
    // Convert context storage URLs to signed URLs if needed
    const signedUrls = await Promise.all(
      contextImageUrls.map(url => convertToSignedUrlIfNeeded(url))
    );

    // Filter out storage URLs that require authentication (only if no credentials available)
    const accessibleContextUrls = signedUrls.filter(url => {
      const isStorageUrl = url.includes('storage.googleapis.com');
      const hasFirebaseCredentials = process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY;
      const hasGoogleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      if (isStorageUrl && !hasFirebaseCredentials && !hasGoogleCredentials) {
        console.log(`🚫 Filtering out inaccessible storage URL (no credentials): ${url.substring(0, 80)}...`);
        return false;
      }
      return true;
    });

    console.log(`🔍 Context images after filtering: ${accessibleContextUrls.length}/${signedUrls.length} accessible`);

    // Limit total images to 10 (GPT-4o limit)
    const maxContextImages = Math.min(accessibleContextUrls.length, 8); // Leave room for user images
    const maxUserImages = Math.min(userImageBase64Data.length, 10 - maxContextImages);

    const contextImages = accessibleContextUrls.slice(0, maxContextImages);
    const userImages = userImageBase64Data.slice(0, maxUserImages);

    // If no accessible images at all, return empty result
    if (contextImages.length === 0 && userImages.length === 0) {
      console.log(`⚠️ No accessible images for vision processing`);
      return '';
    }

    console.log(`🎯 Processing ${contextImages.length} context images + ${userImages.length} user images`);

    // Use OpenAI streaming directly
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1500,
      stream: true,
      messages: [
        {
          role: 'system',
          content: `You are a visual assistant that helps users identify and understand elements in their images by using reference material from a knowledge base.

Your task:
1. CONTEXT IMAGES (first set): These are reference pages/documents from our knowledge base that contain relevant information
2. USER IMAGES (last set): These are the images the user wants to understand or identify

Your goal is to find information in the CONTEXT IMAGES that explains, describes, or identifies what the user is asking about in their USER IMAGES. Look for:
- Matching visual elements between context and user images
- Text descriptions in context images that explain what's shown in user images
- Legends, labels, or documentation in context images that describe elements in user images

Always prioritize information found in the context images over general knowledge.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Question: ${userQuery}

INSTRUCTIONS:
1. First, examine the CONTEXT IMAGES (reference material from our knowledge base) to understand what information they contain
2. Then, look at the USER IMAGES to see what the user is asking about
3. Find any matching, related, or explanatory information in the context images that answers the question about the user images
4. If you find relevant information in the context images, provide that specific information as your answer
5. If no relevant information is found in the context images, then provide a general analysis of the user images

The context images below are reference material, followed by the user's images:`
            },
            // Context images from RAG first
            ...contextImages.map(url => ({
              type: 'image_url' as const,
              image_url: { 
                url,
                detail: 'high' as const
              }
            })),
            // User's uploaded images last
            ...userImages.map(base64 => ({
              type: 'image_url' as const,
              image_url: { 
                url: `data:image/jpeg;base64,${base64}`,
                detail: 'high' as const
              }
            }))
          ]
        }
      ]
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        onTokenCallback(content);
      }
    }

    return fullResponse || 'No analysis available';
  } catch (error) {
    console.error('Error in streaming enhanced vision processing:', error);
    throw error;
  }
}

// Streaming version of processImageWithOpenAI
export async function processImageWithOpenAIStreaming(
  imageUrls: string[],
  query: string,
  onTokenCallback: (token: string) => void
): Promise<string> {
  if (!imageUrls || imageUrls.length === 0) {
    return '';
  }

  try {
    const stream = await openai.chat.completions.create({
      model: IMAGE_MODEL_NAME,
      stream: true,
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

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        onTokenCallback(content);
      }
    }

    return fullResponse || 'No image description available';
  } catch (error) {
    console.error('Error in streaming image processing:', error);
    return 'Error processing image';
  }
}

// Enhanced vision processing with multiple context images and user images
export async function processImagesWithContext(
  userImageBase64Data: string[],
  contextImageUrls: string[],
  userQuery: string,
  modelName: string = IMAGE_MODEL_NAME
): Promise<string> {
  if ((!userImageBase64Data || userImageBase64Data.length === 0) && 
      (!contextImageUrls || contextImageUrls.length === 0)) {
    return '';
  }

  try {
    // Convert context storage URLs to signed URLs if needed
    const signedUrls = await Promise.all(
      contextImageUrls.map(url => convertToSignedUrlIfNeeded(url))
    );

    // Filter out storage URLs that require authentication (only if no credentials available)
    const accessibleContextUrls = signedUrls.filter(url => {
      const isStorageUrl = url.includes('storage.googleapis.com');
      const hasFirebaseCredentials = process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY;
      const hasGoogleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      if (isStorageUrl && !hasFirebaseCredentials && !hasGoogleCredentials) {
        console.log(`🚫 Filtering out inaccessible storage URL (no credentials): ${url.substring(0, 80)}...`);
        return false;
      }
      return true;
    });

    console.log(`🔍 Context images after filtering: ${accessibleContextUrls.length}/${signedUrls.length} accessible`);

    // Limit total images to 10 (GPT-4o limit)
    const maxContextImages = Math.min(accessibleContextUrls.length, 8); // Leave room for user images
    const maxUserImages = Math.min(userImageBase64Data.length, 10 - maxContextImages);

    const contextImages = accessibleContextUrls.slice(0, maxContextImages);
    const userImages = userImageBase64Data.slice(0, maxUserImages);

    // If no accessible images at all, return empty result
    if (contextImages.length === 0 && userImages.length === 0) {
      console.log(`⚠️ No accessible images for vision processing`);
      return '';
    }

    console.log(`🎯 Processing ${contextImages.length} context images + ${userImages.length} user images`);
    console.log(`📋 Context image URLs (full):`, contextImages);
    console.log(`📋 User images:`, userImages.map(b64 => `base64 data (${b64.length} chars)`));
    
    // Check if context images are signed URLs or base64
    contextImages.forEach((url, index) => {
      console.log(`📋 Context image ${index + 1} type:`, url.startsWith('data:') ? 'base64' : 'URL');
      console.log(`📋 Context image ${index + 1} format:`, url.substring(0, 50) + '...');
    });

    const response = await openai.chat.completions.create({
      model: modelName,
      max_tokens: 1500, // Set token limit for detailed analysis
      messages: [
        {
          role: 'system',
          content: `You are a visual assistant that helps users identify and understand elements in their images by using reference material from a knowledge base.

Your task:
1. CONTEXT IMAGES (first set): These are reference pages/documents from our knowledge base that contain relevant information
2. USER IMAGES (last set): These are the images the user wants to understand or identify

Your goal is to find information in the CONTEXT IMAGES that explains, describes, or identifies what the user is asking about in their USER IMAGES. Look for:
- Matching visual elements between context and user images
- Text descriptions in context images that explain what's shown in user images
- Legends, labels, or documentation in context images that describe elements in user images

Always prioritize information found in the context images over general knowledge.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Question: ${userQuery}

INSTRUCTIONS:
1. First, examine the CONTEXT IMAGES (reference material from our knowledge base) to understand what information they contain
2. Then, look at the USER IMAGES to see what the user is asking about
3. Find any matching, related, or explanatory information in the context images that answers the question about the user images
4. If you find relevant information in the context images, provide that specific information as your answer
5. If no relevant information is found in the context images, then provide a general analysis of the user images

The context images below are reference material, followed by the user's images:`
            },
            // Context images from RAG first
            ...contextImages.map(url => ({
              type: 'image_url' as const,
              image_url: { 
                url,
                detail: 'high' as const // Use 'high' for detailed analysis
              }
            })),
            // User's uploaded images last
            ...userImages.map(base64 => ({
              type: 'image_url' as const,
              image_url: { 
                url: `data:image/jpeg;base64,${base64}`,
                detail: 'high' as const
              }
            }))
          ]
        }
      ]
    });

    return response.choices[0]?.message?.content ?? 'No analysis available';
  } catch (error) {
    console.error('Error in enhanced vision processing:', error);
    throw error;
  }
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

