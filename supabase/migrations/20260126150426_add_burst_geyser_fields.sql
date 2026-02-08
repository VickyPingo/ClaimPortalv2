/*
  # Add Burst Geyser Specific Fields

  ## Overview
  Adds detailed fields for burst geyser claims to capture:
  - Burst date and time
  - Geyser type (Electric, Gas, Solar)
  - Whether damage resulted from the leak
  - Location address (may differ from GPS)
  - Additional voice notes

  ## Changes
  - Add `burst_datetime` column for when the burst occurred
  - Add `geyser_type` column (electric/gas/solar)
  - Add `has_resulting_damage` column (boolean)
  - Add `location_address` column for address details
  - Add `extra_voice_note_url` for additional voice notes
  - Add `extra_voice_transcript_en` for transcribed extra notes

  ## Security
  - All columns nullable to maintain backwards compatibility
  - No RLS policy changes needed (inherited from claims table)
*/

DO $$
BEGIN
  -- Add burst_datetime if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'burst_datetime'
  ) THEN
    ALTER TABLE claims ADD COLUMN burst_datetime timestamptz;
  END IF;

  -- Add geyser_type if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'geyser_type'
  ) THEN
    ALTER TABLE claims ADD COLUMN geyser_type text CHECK (geyser_type IS NULL OR geyser_type IN ('electric', 'gas', 'solar'));
  END IF;

  -- Add has_resulting_damage if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'has_resulting_damage'
  ) THEN
    ALTER TABLE claims ADD COLUMN has_resulting_damage boolean;
  END IF;

  -- Add location_address if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'location_address'
  ) THEN
    ALTER TABLE claims ADD COLUMN location_address text;
  END IF;

  -- Add extra_voice_note_url if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'extra_voice_note_url'
  ) THEN
    ALTER TABLE claims ADD COLUMN extra_voice_note_url text;
  END IF;

  -- Add extra_voice_transcript_en if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'extra_voice_transcript_en'
  ) THEN
    ALTER TABLE claims ADD COLUMN extra_voice_transcript_en text;
  END IF;
END $$;
