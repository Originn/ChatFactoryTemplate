-- Migration: Add contextualized_question column to questions_and_answers table
-- This column will store the AI-generated contextualized version of user questions

ALTER TABLE questions_and_answers 
ADD COLUMN IF NOT EXISTS contextualized_question TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN questions_and_answers.contextualized_question IS 'AI-generated contextualized version of the user question that incorporates chat history context';