/*
  # Add AI summary column to claims

  1. Changes
    - Add `ai_summary` text column to `claims` table
    - This will store AI-generated summaries from OpenAI GPT-4o-mini
    - Column is nullable (summary is generated asynchronously after claim submission)

  2. Notes
    - Summary will be generated after claim submission or voice transcription
    - Uses claim data, voice transcript, and incident details
    - Helps brokers quickly understand each case
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'ai_summary'
  ) THEN
    ALTER TABLE claims ADD COLUMN ai_summary text;
  END IF;
END $$;
