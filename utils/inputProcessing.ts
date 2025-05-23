import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import OpenAIChat from 'openai';
import MemoryService from '@/utils/memoryService';
import {
  TRANSLATION_PROMPT,
  LANGUAGE_DETECTION_PROMPT,
  IMAGE_ANALYSIS_PROMPT,
  IMAGE_RELATION_PROMPT
} from './prompts/promptTemplates';

const IMAGE_MODEL_NAME = process.env.IMAGE_MODEL_NAME || 'gpt-4.1-mini';

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

  if (imageUrls && imageUrls.length > 0) {
    imageDescription = await processImageWithOpenAI(imageUrls, input);
  }

  const language = await detectLanguageWithOpenAI(processedInput, sharedModel);
  const originalInput = processedInput;

  if (language !== 'English') {
    processedInput = await translateToEnglish(processedInput, translationModel);
  }

  if (imageDescription) {
    processedInput = `${processedInput} [Image model answer: ${imageDescription}]`;
  }

  if (imageUrls.length === 0) {
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
