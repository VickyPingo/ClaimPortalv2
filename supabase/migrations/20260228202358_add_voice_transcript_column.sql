/*
  # Add voice transcript column to claims

  1. Changes
    - Add `voice_transcript` text column to `claims` table
    - This will store the transcription from OpenAI Whisper API
    - Column is nullable (transcription happens asynchronously after upload)

  2. Notes
    - Transcription will be updated after voice note upload
    - Brokers can view transcripts in claim details
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'voice_transcript'
  ) THEN
    ALTER TABLE claims ADD COLUMN voice_transcript text;
  END IF;
END $$;
