/*
  # Add Broker Notes to Client Profiles

  1. Changes
    - Add `broker_notes` column to `client_profiles` table
      - Type: text (nullable)
      - Purpose: Private notes that brokers can write about clients
      - Only accessible by authenticated brokers

  2. Security
    - No RLS changes needed as client_profiles already has proper RLS policies
    - Broker notes are part of the client profile data brokers can already access
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_profiles' AND column_name = 'broker_notes'
  ) THEN
    ALTER TABLE client_profiles ADD COLUMN broker_notes text DEFAULT '';
  END IF;
END $$;
