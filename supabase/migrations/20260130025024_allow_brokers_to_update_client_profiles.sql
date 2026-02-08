/*
  # Allow Brokers to Update Client Profiles

  1. Changes
    - Add UPDATE policy for brokers to modify client_profiles
    - Brokers can update all fields including broker_notes

  2. Security
    - Only authenticated broker users can update client profiles
    - Policy checks that user exists in broker_profiles table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_profiles'
    AND policyname = 'Brokers can update client profiles'
  ) THEN
    CREATE POLICY "Brokers can update client profiles"
      ON client_profiles
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM broker_profiles
          WHERE broker_profiles.id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM broker_profiles
          WHERE broker_profiles.id = auth.uid()
        )
      );
  END IF;
END $$;
