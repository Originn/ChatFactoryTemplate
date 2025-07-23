// db.d.ts - Type definitions for db.js

import { Pool, QueryResult } from 'pg';

// Define the types for the pool object and exported functions
export const pool: Pool;

// Type definitions for the exported functions
export function insertQA(
  chatbotId: string,
  question: string, 
  answer: string, 
  embeddings: any, 
  sources: any, 
  qaId: string, 
  roomId: string, 
  userEmail: string, 
  imageurl?: string | string[],
  language?: string,
  modelType?: string,
  contextualizedQuestion?: string
): Promise<any>;

export function updateFeedback(
  chatbotId: string,
  qaId: string, 
  thumb: boolean, 
  comment: string, 
  roomId: string
): Promise<any>;

export function insertQuestionEmbedderDetails(
  chatbotId: string,
  embeddedText: string, 
  timestamp: string, 
  email: string
): Promise<any>;

export function insertChatHistory(
  chatbotId: string,
  userEmail: string, 
  conversationTitle: string, 
  roomId: string, 
  messages: any[]
): Promise<any>;

export function getChatHistory(
  userEmail: string, 
  range?: string
): Promise<any[]>;

export function getChatHistoryByRoomId(
  chatbotId: string,
  roomId: string
): Promise<any>;

export function getTitleByRoomId(
  roomId: string
): Promise<any>;

export function deleteOldChatHistory(): Promise<number>;

// Add the missing type definitions for privacy functions
export function getUserPrivacySettings(
  chatbotId: string,
  uid: string
): Promise<{
  uid: string;
  email: string;
  store_history: boolean;
  retention_period: string;
  allow_analytics?: boolean;
  updated_at?: Date;
} | undefined>;

export function updateUserPrivacySettings(
  chatbotId: string,
  uid: string,
  email: string,
  allowAnalytics: boolean,
  storeHistory: boolean,
  retentionPeriod: string
): Promise<any>;

export function getUserAIProvider(
  userEmail: string
): Promise<string>;

export function getAPIKeyForProvider(
  provider: string,
  userEmail: string
): Promise<string | undefined>;

// Add cache embedding functions
export function cacheEmbedding(
  chatbotId: string,
  contentHash: string,
  modelName: string,
  embedding: number[] | string,
  contentText?: string
): Promise<any>;

export function getCachedEmbedding(
  chatbotId: string,
  contentHash: string,
  modelName?: string
): Promise<any>;