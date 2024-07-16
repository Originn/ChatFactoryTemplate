// pages/api/chatWithImages.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getIO } from "@/socketServer.cjs";
import createClient from "openai";
import { ChatCompletionMessageParam, ChatCompletionContentPart } from "openai/resources/chat";
import MemoryService from '@/utils/memoryService';
import { HumanMessage, AIMessage } from "@langchain/core/messages";

// Initialize OpenAI client
const openAIClient = new createClient({});

// New utility function to handle user question with multiple images
async function answerUserQuestionWithImages(imageUrls: string[], userQuestion: string, roomId: string) {
  const io = getIO();

  try {
    const content: ChatCompletionContentPart[] = [
      { type: "text", text: userQuestion },
      ...imageUrls.map(url => ({ 
        type: "image_url", 
        image_url: { url: url, detail: "auto" } 
      } as ChatCompletionContentPart))
    ];

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: "Don't answer question about images that are not related to SolidCAM!. You are a multilingual helpful and friendly assistant. You focus on helping SolidCAM users with their questions. Look at the Image before answering."
      },
      {
        role: "user",
        content: content,
      }
    ];

    const response = await openAIClient.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      max_tokens: 300,
      stream: true, // Enable streaming
    });

    let answer = '';
    for await (const token of response) {
      if (token.choices[0]?.delta?.content) {
        answer += token.choices[0].delta.content;
        io.to(roomId).emit("newToken", token.choices[0].delta.content);
      }
    }

    return answer;
  } catch (error) {
    console.error('Error getting answer with images:', error);
    io.to(roomId).emit("newToken", "Error getting answer with images.");
    return "Error getting answer with images.";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { question, roomId, imageUrls } = req.body;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!roomId || !question) {
    return res.status(400).json({ message: 'Missing roomId or question in the request' });
  }

  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  try {
    let chatMemory = MemoryService.getChatMemory(roomId);

    const answer = await answerUserQuestionWithImages(imageUrls, question, roomId);

    // Add the AI's answer to the memory
    await chatMemory.saveContext({ question: question }, { text: answer });

    // Update the memory in the MemoryService
    MemoryService.updateChatMemory(roomId, chatMemory);

    return res.status(200).json({ message: answer });
  } catch (error: any) {
    console.error('Error', error);
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}