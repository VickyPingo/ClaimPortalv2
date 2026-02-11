/*
  # Add email column to invitations table

  1. Changes
    - Add `email` column to `invitations` table
      - Type: text (nullable)
      - Purpose: Store the specific email address for targeted invitations
      - Note: NULL values indicate open invitations (anyone with link can use)

  2. Notes
    - Existing invitations remain functional
    - No data migration needed as all existing records will have NULL email (open invitations)
    - Application already handles NULL email values correctly
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invitations' AND column_name = 'email'
  ) THEN
    ALTER TABLE invitations ADD COLUMN email text;
    
    -- Add index for faster email lookups
    CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
    
    COMMENT ON COLUMN invitations.email IS 'Specific email address for targeted invitations. NULL = open invitation (anyone can use)';
  END IF;
END $$;