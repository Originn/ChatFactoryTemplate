// pages/api/gppQuestions.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getIO } from "@/socketServer.cjs";
import { v4 as uuidv4 } from 'uuid';
import { insertQA } from '../../db';  // Import only insertQA
import { getChatHistoryByRoomId } from '../../db';
import { Message } from '@/types/chat';
import MemoryService from '@/utils/memoryService';


const gppKeyword = process.env.NEXT_PUBLIC_CODEBASE_KEYWORD ?? "baseCodeQuestion";
const RAG_API_URL = process.env.RAG_API_URL ?? "https://lightrag-codebase-8bc962afff7d.herokuapp.com/";

const roomSessions: { [key: string]: boolean } = {};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { question, roomId, userEmail } = req.body;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  if (!roomId) {
    return res.status(400).json({ message: 'No roomId in the request' });
  }

  const sanitizedQuestion = question?.trim().replaceAll('\n', ' ');
  const io = getIO();

  try {
    if (!question) {
      return res.status(400).json({ message: 'No question in the request' });
    }

    // Handle initial greeting
    if (sanitizedQuestion.startsWith(gppKeyword) && !roomSessions[roomId]) {
      const greetingMessage = 'Welcome to Code Base Questions Mode! Feel free to ask any question.';
      io.to(roomId).emit(`tokenStream-${roomId}`, greetingMessage);
      roomSessions[roomId] = true;
      return res.status(200).json({ message: 'Greeting sent successfully.' });
    }

    let chatHistoryRecord = await getChatHistoryByRoomId(roomId);
    console.log("chatHistoryRecord:", chatHistoryRecord);
    let messages: Message[] = [];
    if (chatHistoryRecord && chatHistoryRecord.conversation_json) {
      messages = chatHistoryRecord.conversation_json;
    }

    const userMessage: Message = {
      type: 'userMessage',
      message: sanitizedQuestion,
      isComplete: true,
      // Add any other properties if needed
    };
    messages.push(userMessage);

    // Make request to RAG API
    const queryBody = {
      query: sanitizedQuestion,
      mode: "hybrid",
      chat_history: messages.map((msg) => ({
        role: msg.type === 'userMessage' ? 'user' : 'assistant',
        content: msg.message,
      })),
    };

    const response = await fetch(`${RAG_API_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryBody),
    });

    if (!response.ok) {
      throw new Error(`RAG API responded with status ${response.status}`);
    }

    const ragResponse = await response.json();
    const aiResponse = ragResponse.data;
    
    // Generate QA ID
    const qaId = uuidv4();

    // Insert into database
    await insertQA(
      sanitizedQuestion,
      aiResponse,
      'codebaseQuestion',
      [],
      qaId,
      roomId,
      userEmail
    );

    // Update chat history using updateChatMemory
    await MemoryService.updateChatMemory(
      roomId,
      sanitizedQuestion,
      aiResponse,
      null, // Assuming no images in this context
      userEmail,
      [], // Empty source docs
      qaId,
      '' // Optionally pass conversation title
    );

    // Send AI response back to client through socket
    if (aiResponse) {
      io.to(roomId).emit(`tokenStream-${roomId}`, aiResponse);
    }

    return res.status(200).json({ 
      message: 'Question processed successfully.',
      answer: ragResponse.data,
      qaId: qaId
    });

  } catch (error: any) {
    console.error('Error in codebase Questions Handler:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}