/*
  # Make Claims Publicly Accessible

  ## Changes
  This migration allows anonymous claim submissions by making client_id optional
  and adding public insert policies.

  ## 1. Schema Changes
  - Make `client_id` nullable in claims table to allow anonymous submissions
  - Add contact information fields for anonymous claimants

  ## 2. Security Updates
  - Add policy for anonymous (public) claim insertion
  - Anonymous users can submit claims without authentication
  - Brokers can still view all claims through existing policies
  
  ## 3. Important Notes
  - Claims can now be submitted without authentication
  - Contact information is captured for follow-up
  - Brokers maintain full visibility of all submitted claims
*/

-- Make client_id nullable to allow anonymous submissions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'client_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE claims ALTER COLUMN client_id DROP NOT NULL;
  END IF;
END $$;

-- Add contact information fields for anonymous submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'claimant_name'
  ) THEN
    ALTER TABLE claims ADD COLUMN claimant_name text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'claimant_phone'
  ) THEN
    ALTER TABLE claims ADD COLUMN claimant_phone text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'claimant_email'
  ) THEN
    ALTER TABLE claims ADD COLUMN claimant_email text;
  END IF;
END $$;

-- Drop the restrictive INSERT policies for clients
DROP POLICY IF EXISTS "Clients can insert claims for their brokerage" ON claims;

-- Create public policy to allow anonymous claim submissions
CREATE POLICY "Anyone can submit claims"
  ON claims FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
