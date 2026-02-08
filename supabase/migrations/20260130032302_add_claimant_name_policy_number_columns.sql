/*
  # Add Claimant Name and Policy Number Columns

  ## Overview
  Add direct text columns to store claimant information in each claim record.
  This eliminates reliance on JOINs and prevents "Unknown Client" issues.

  ## Changes
  
  ### New Columns
  1. `claimant_name` (text)
     - Stores the client's full name at time of submission
     - Displayed directly in broker dashboard
     - No JOIN required
  
  2. `policy_number` (text)
     - Stores the client's policy number
     - Direct reference for claims processing
  
  ## Benefits
  - No more "Unknown Client" in broker views
  - Self-contained claim records
  - Faster queries (no JOINs needed for display)
*/

-- Add claimant_name column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'claimant_name'
  ) THEN
    ALTER TABLE claims ADD COLUMN claimant_name text DEFAULT '';
  END IF;
END $$;

-- Add policy_number column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'policy_number'
  ) THEN
    ALTER TABLE claims ADD COLUMN policy_number text DEFAULT '';
  END IF;
END $$;

-- Create index for faster searches on claimant_name
CREATE INDEX IF NOT EXISTS idx_claims_claimant_name ON claims(claimant_name);

-- Create index for faster searches on policy_number
CREATE INDEX IF NOT EXISTS idx_claims_policy_number ON claims(policy_number);
