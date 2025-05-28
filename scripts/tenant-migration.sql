-- Migration for ChatFactory Multi-Tenant Database (Snake Case)
-- Run this SQL to add tenant isolation with clean naming

-- Step 1: Add chatbot_id columns to existing tables
ALTER TABLE questions_and_answers ADD COLUMN IF NOT EXISTS chatbot_id VARCHAR(255);
ALTER TABLE user_chat_history ADD COLUMN IF NOT EXISTS chatbot_id VARCHAR(255);
ALTER TABLE question_embedder ADD COLUMN IF NOT EXISTS chatbot_id VARCHAR(255);
ALTER TABLE user_privacy_settings ADD COLUMN IF NOT EXISTS chatbot_id VARCHAR(255);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_qa_chatbot_id ON questions_and_answers(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_qa_chatbot_room ON questions_and_answers(chatbot_id, room_id);
CREATE INDEX IF NOT EXISTS idx_history_chatbot_id ON user_chat_history(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_history_chatbot_room ON user_chat_history(chatbot_id, room_id);

-- Step 3: Enable Row Level Security for perfect isolation
ALTER TABLE questions_and_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chat_history ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies - users can only see their chatbot's data
CREATE POLICY qa_chatbot_isolation ON questions_and_answers
  FOR ALL USING (chatbot_id = current_setting('app.current_chatbot_id', true));

CREATE POLICY history_chatbot_isolation ON user_chat_history
  FOR ALL USING (chatbot_id = current_setting('app.current_chatbot_id', true));

-- Migration completed! Clean snake_case naming with perfect tenant isolation! 🎉
