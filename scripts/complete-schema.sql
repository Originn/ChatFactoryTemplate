-- Complete Schema with Snake Case Naming
-- Part 1: Core Tables

-- Create questions_and_answers table with proper naming
CREATE TABLE IF NOT EXISTS questions_and_answers (
  id SERIAL PRIMARY KEY,
  chatbot_id VARCHAR(255) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  embeddings JSONB,
  sources JSONB,
  qa_id VARCHAR(255),
  room_id VARCHAR(255),
  user_email VARCHAR(255),
  imageurl TEXT,
  language VARCHAR(10),
  model_type VARCHAR(50) DEFAULT 'openai',
  thumb VARCHAR(10),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create question_embedder table
CREATE TABLE IF NOT EXISTS question_embedder (
  id SERIAL PRIMARY KEY,
  chatbot_id VARCHAR(255) NOT NULL,
  embedded_text TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  email VARCHAR(255)
);

-- Create user_chat_history table  
CREATE TABLE IF NOT EXISTS user_chat_history (
  id SERIAL PRIMARY KEY,
  chatbot_id VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  conversation_title TEXT,
  room_id VARCHAR(255) UNIQUE,
  conversation_json JSONB,
  date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
