/*
  # Add damage description voice recording fields

  1. Changes
    - Add `damage_description_url` (text) for audio file
    - Add `damage_description_transcript` (text) for transcription
    - Remove `damage_description` (text) as it's replaced by voice note

  2. Notes
    - Maintains backward compatibility
    - Allows automatic transcription of damage descriptions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'all_risk_claims' AND column_name = 'damage_description_url'
  ) THEN
    ALTER TABLE all_risk_claims ADD COLUMN damage_description_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'all_risk_claims' AND column_name = 'damage_description_transcript'
  ) THEN
    ALTER TABLE all_risk_claims ADD COLUMN damage_description_transcript text;
  END IF;
END $$;
