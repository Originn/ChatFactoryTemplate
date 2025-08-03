// Modified version of utils/memoryService.ts

import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import BufferMemory from "./BufferMemory";
import { Message } from '@/types/chat';
import { auth as clientAuth } from '@/utils/firebase'; // For client-side access
import path from 'path';
import fs from 'fs';

// Import tenant-isolated database wrapper
const TenantDB = require('./TenantDB');
const db = new TenantDB();

// Only import firebase-admin on the server side
let admin: any = null;

if (typeof window === 'undefined') {
  admin = require('firebase-admin');
  const fs = require('fs');
  const path = require('path');

  if (!admin.apps.length) {
    try {
      // Use service account credentials from environment variables
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      } else {
        console.warn('Firebase Admin: No credentials found. Anonymous users will work, but authenticated features disabled.');
      }
    } catch (error) {
      console.error('❌ Firebase Admin initialization failed', error);
    }
  }
}


class MemoryService {
  private static chatMemory: Record<string, BufferMemory> = {};

  static getChatMemory(roomId: string): BufferMemory {
    if (!this.chatMemory[roomId]) {
      this.chatMemory[roomId] = new BufferMemory({
        memoryKey: "chat_history",
      });
    }
    return this.chatMemory[roomId];
  }

  static async updateChatMemory(
    roomId: string,
    input: string,
    output: string | null,
    imageUrl: string[] | null,
    userEmail: string | null,
    sourceDocs: any[] | null = null,
    qaId: string | null = null,
    conversationTitle: string = ''
  ): Promise<void> {
    // Skip database operations on client side
    if (typeof window !== 'undefined') {
      // Just update in-memory state on client-side
      const memory = this.getChatMemory(roomId);
      
      // Add user message to memory
      if (input) {
        const humanMessage = new HumanMessage(input);
        if (imageUrl && imageUrl.length > 0) {
          humanMessage.additional_kwargs = { imageUrls: imageUrl };
        }
        memory.messages.push(humanMessage);
      }
      
      // Add AI message to memory
      if (output) {
        const aiMessage = new AIMessage(output);
        aiMessage.additional_kwargs = {
          qaId: qaId || undefined,
          sourceDocs: sourceDocs || [],
        };
        memory.messages.push(aiMessage);
      }
      
      return;
    }
    
    // Server-side code continues below
    // GDPR CHECK: Skip storing history if user has disabled it
    if (userEmail) {
      try {
        // Handle anonymous users or validate email format
        if (userEmail === 'anonymous' || userEmail === 'anon' || !userEmail) {
          console.log('Anonymous user detected, skipping Firebase auth');
          return;
        }
        
        // Validate email format before attempting Firebase Auth
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userEmail)) {
          console.warn('Invalid email format provided:', userEmail);
          return;
        }

        // Get the current user's UID directly
        let uid = null;
        
        // We're already on server-side here (we checked window above)
        if (admin) {
          try {
            const userRecord = await admin.auth().getUserByEmail(userEmail);
            uid = userRecord.uid;
          } catch (firebaseError) {
            console.error('Error getting user from Firebase:', firebaseError);
          }
        }
        if (uid) {
          // Get the user's privacy settings
          const privacySettings = await db.getUserPrivacySettings(uid);
          
          // If storeHistory is explicitly set to false, don't save anything
          if (privacySettings && privacySettings.store_history === false) {
            return;
          }
        }
      } catch (error) {
        console.error('Error checking privacy settings:', error);
        // Continue with storing history in case of error (fail open)
      }
    }
    
    // Retrieve existing chat history from the database
    let chatHistoryRecord = await db.getChatHistoryByRoomId(roomId);
  
    // Fetch the title by roomId and extract the conversation_title property
    // let titleRecord = await getTitleByRoomId(roomId);
    // let title = titleRecord?.conversation_title || ''; // Extract the conversation_title or default to an empty string
    let title = ''; // Temporarily simplified - will use conversationTitle fallback
  
    // Use conversationTitle if title is empty or undefined
    title = title.trim() || conversationTitle.trim();
  
    // Ensure a fallback to a default if both are empty
    if (!title) {
      title = conversationTitle.trim();
    }
  
    let messages: Message[] = [];
    if (chatHistoryRecord && chatHistoryRecord.conversation_json) {
      // Filter out the initial "Hi" message from existing messages
      messages = chatHistoryRecord.conversation_json.filter(
        (msg: Message) => !(msg.type === 'userMessage' && msg.message === 'Hi')
      );
    }
  
    // Process input message
    if (input) {
      const humanMessage: Message = {
        type: 'userMessage',
        message: input,
        isComplete: true,
      };
      if (imageUrl && imageUrl.length > 0) {
        humanMessage.imageUrls = imageUrl;
      }
      messages.push(humanMessage);
    }
  
    // Process output message
    if (output) {
      const aiMessage: Message = {
        qaId: qaId || undefined,
        type: 'apiMessage',
        message: output,
        isComplete: true,
        sourceDocs: sourceDocs || undefined,
      };
      messages.push(aiMessage);
    }
  
    // Update chat history in the database with the validated title
    await db.insertChatHistory(userEmail || '', title, roomId, messages);
  }
  
  // Rest of the methods remain the same...
  static async getHasProcessedImage(roomId: string): Promise<boolean> {
    // Skip database access on client side
    if (typeof window !== 'undefined') {
      // If we're on client-side, check in-memory data
      if (this.chatMemory[roomId] && this.chatMemory[roomId].metadata && this.chatMemory[roomId].metadata.hasProcessedImage) {
        return this.chatMemory[roomId].metadata.hasProcessedImage;
      }
      return false;
    }
    
    // Server-side code proceeds with database access
    const chatHistoryRecord = await db.getChatHistoryByRoomId(roomId);
  
    // Check if any userMessage in conversation_json has non-empty imageUrls
    if (chatHistoryRecord && Array.isArray(chatHistoryRecord.conversation_json)) {
      return chatHistoryRecord.conversation_json.some((msg: any) => 
        msg.type === 'userMessage' && msg.imageUrls && msg.imageUrls.length > 0
      );
    }
  
    // Default to false if no such message with imageUrls is found
    return false;
  }

  static async getChatHistory(roomId: string): Promise<BaseMessage[]> {
    // Skip database access on client side
    if (typeof window !== 'undefined') {
      // If we're on client-side, use in-memory data if available
      if (this.chatMemory[roomId] && this.chatMemory[roomId].messages.length > 0) {
        return this.chatMemory[roomId].messages;
      }
      return []; // Return empty array on client-side with no data
    }
    
    // Server-side code proceeds with database access
    const chatHistoryRecord = await db.getChatHistoryByRoomId(roomId);
    if (!chatHistoryRecord || !chatHistoryRecord.conversation_json) {
      return [];
    }
  
    const messages: Message[] = chatHistoryRecord.conversation_json;
  
    // Convert stored messages to BaseMessage objects
    const baseMessages: BaseMessage[] = messages.map((msg) => {
      if (msg.type === 'userMessage') {
        const humanMessage = new HumanMessage(msg.message);
        if (msg.imageUrls && msg.imageUrls.length > 0) {
          humanMessage.additional_kwargs = { imageUrls: msg.imageUrls };
        }
        return humanMessage;
      } else if (msg.type === 'apiMessage') {
        const aiMessage = new AIMessage(msg.message);
        aiMessage.additional_kwargs = {
          qaId: msg.qaId,
          sourceDocs: msg.sourceDocs || [],
        };
        return aiMessage;
      } else {
        throw new Error(`Unknown message type: ${msg.type}`);
      }
    });
  
    return baseMessages;
  }
  

  static clearChatMemory(roomId: string): void {
    const memory = this.getChatMemory(roomId);
    memory.messages = [];
    memory.metadata = {};
  }

  static loadFullConversationHistory(roomId: string, conversationHistory: any[]): void {
    const memory = this.getChatMemory(roomId);
  
    // Keep track of all image URLs in the conversation
    const allImageUrls: string[] = [];
  
    memory.messages = conversationHistory.map((msg) => {
      if (msg.type === "userMessage") {
        const humanMessage = new HumanMessage(msg.message);
        if (msg.imageUrls && msg.imageUrls.length > 0) {
          humanMessage.additional_kwargs = {
            imageUrls: msg.imageUrls,
          };
          allImageUrls.push(...msg.imageUrls);
        }
        return humanMessage;
      } else if (msg.type === "apiMessage") {
        const aiMessage = new AIMessage(msg.message);
        aiMessage.additional_kwargs = {
          qaId: msg.qaId,
          sourceDocs: msg.sourceDocs || [],
        };
        return aiMessage;
      } else {
        // Throw an error for unknown message types
        throw new Error(`Unknown message type: ${msg.type}`);
      }
    });
  
    // Update metadata with ALL image URLs from the conversation
    memory.metadata = {
      ...memory.metadata,
      imageUrl: allImageUrls.length > 0 ? allImageUrls : [],
      hasProcessedImage: allImageUrls.length > 0,
    };
  }
}

export default MemoryService;