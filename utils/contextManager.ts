import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { OpenAIEmbeddings } from '@langchain/openai';
import { createEmbeddingModel } from './embeddingProviders';

interface HistoryOptions {
  maxTurns?: number;           // Maximum conversation turns to include (default: 3)
  useSemanticSearch?: boolean; // Whether to use semantic relevance (default: false)
  includeSummary?: boolean;    // Whether to include conversation summary (default: false)
  recencyWeight?: number;      // Weight for recency vs relevance (0-1, default: 0.7)
}

/**
 * Extract relevant conversation history for context-aware question rephrasing
 * 
 * @param rawHistory Full conversation history
 * @param currentQuery Current user question
 * @param options Configuration options
 * @returns Filtered conversation history with most relevant context
 */
export async function getRelevantHistory(
  rawHistory: (HumanMessage | AIMessage)[],
  currentQuery: string,
  options: HistoryOptions = {}
): Promise<(HumanMessage | AIMessage)[]> {
  // Set defaults
  const {
    maxTurns = 3,
    useSemanticSearch = false,
    includeSummary = false,
    recencyWeight = 0.7
  } = options;
  
  // Return empty array if no history
  if (!rawHistory || rawHistory.length === 0) {
    return [];
  }
  
  // Always include the most recent conversation turn (Q&A pair)
  if (rawHistory.length <= 2) {
    return rawHistory; // If only one turn or less, return all
  }
  
  // For simple recency-based approach (most common case)
  if (!useSemanticSearch) {
    // Get last N conversation turns (a turn is a Q&A pair)
    const maxMessages = maxTurns * 2; // Each turn has 2 messages
    return rawHistory.slice(-Math.min(maxMessages, rawHistory.length));
  }
  
  // For semantic search approach
  // Step 1: Create embeddings for the current query and history messages
  try {
    const embedder = createEmbeddingModel(); // Use dynamic embedding model from env vars
    const queryEmbedding = await embedder.embedQuery(currentQuery);
    
    // Step 2: Calculate relevance scores for each history message
    const messageScores: { message: HumanMessage | AIMessage; score: number; index: number }[] = [];
    
    for (let i = 0; i < rawHistory.length; i++) {
      const message = rawHistory[i];
      
      // Only compute embeddings for user messages (questions) to save on API calls
      if (message instanceof HumanMessage) {
        const msgEmbedding = await embedder.embedQuery(message.content as string);
        
        // Calculate cosine similarity
        const similarityScore = cosineSimilarity(queryEmbedding, msgEmbedding);
        
        // Calculate recency score (newer = higher score)
        const recencyScore = i / rawHistory.length;
        
        // Calculate combined score with weighting
        const combinedScore = (similarityScore * (1 - recencyWeight)) + (recencyScore * recencyWeight);
        
        messageScores.push({ message, score: combinedScore, index: i });
      }
    }
    
    // Step 3: Sort and select top messages
    messageScores.sort((a, b) => b.score - a.score);
    
    // Step 4: Get top N most relevant question messages
    const topRelevantQuestions = messageScores.slice(0, maxTurns);
    
    // Step 5: Include both questions and their corresponding answers
    const relevantIndices = new Set<number>();
    
    topRelevantQuestions.forEach(item => {
      relevantIndices.add(item.index); // Add question
      if (item.index + 1 < rawHistory.length) {
        relevantIndices.add(item.index + 1); // Add corresponding answer
      }
    });
    
    // Always include the most recent turn regardless of relevance
    if (rawHistory.length >= 2) {
      relevantIndices.add(rawHistory.length - 2); // Most recent question
      relevantIndices.add(rawHistory.length - 1); // Most recent answer
    }
    
    // Convert to array, sort, and get messages
    const sortedIndices = Array.from(relevantIndices).sort((a, b) => a - b);
    return sortedIndices.map(idx => rawHistory[idx]);
  } catch (error) {
    console.error("Error in semantic history search:", error);
    // Fallback to recency-based approach
    const maxMessages = maxTurns * 2;
    return rawHistory.slice(-Math.min(maxMessages, rawHistory.length));
  }
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * @param vecA First vector
 * @param vecB Second vector
 * @returns Similarity score between 0 and 1
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same dimensions");
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
