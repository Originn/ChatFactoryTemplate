CREATE TABLE questions_and_answers (
  id BIGSERIAL,
  chatbot_id VARCHAR(255) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  embeddings JSONB,
  sources JSONB,
  qa_id VARCHAR(255),
  room_id VARCHAR(255),
  user_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, chatbot_id)
) PARTITION BY HASH (chatbot_id);

CREATE TABLE user_chat_history (
  id BIGSERIAL,
  chatbot_id VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  room_id VARCHAR(255),
  conversation_json JSONB,
  date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, chatbot_id),
  UNIQUE (room_id, chatbot_id)
) PARTITION BY HASH (chatbot_id);

CREATE TABLE document_embeddings (
  id BIGSERIAL,
  chatbot_id VARCHAR(255) NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  model_name VARCHAR(100) DEFAULT 'text-embedding-3-small',
  embedding vector(1536),
  content_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, chatbot_id),
  UNIQUE (chatbot_id, content_hash, model_name)
) PARTITION BY HASH (chatbot_id);

DO $$ 
DECLARE i INT;
BEGIN
    FOR i IN 0..15 LOOP
        EXECUTE format('CREATE TABLE questions_and_answers_p%s PARTITION OF questions_and_answers FOR VALUES WITH (modulus 16, remainder %s)', i, i);
        EXECUTE format('CREATE TABLE user_chat_history_p%s PARTITION OF user_chat_history FOR VALUES WITH (modulus 16, remainder %s)', i, i);
        EXECUTE format('CREATE TABLE document_embeddings_p%s PARTITION OF document_embeddings FOR VALUES WITH (modulus 16, remainder %s)', i, i);
    END LOOP;
END $$;

CREATE INDEX idx_qa_fast ON questions_and_answers (chatbot_id, room_id);
CREATE INDEX idx_history_fast ON user_chat_history (chatbot_id, room_id);
CREATE INDEX idx_embeddings_fast ON document_embeddings (chatbot_id, content_hash);

ALTER TABLE questions_and_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY qa_isolation ON questions_and_answers FOR ALL USING (chatbot_id = current_setting('app.current_chatbot_id', true));
CREATE POLICY history_isolation ON user_chat_history FOR ALL USING (chatbot_id = current_setting('app.current_chatbot_id', true));
CREATE POLICY embeddings_isolation ON document_embeddings FOR ALL USING (chatbot_id = current_setting('app.current_chatbot_id', true));
