/*
  # Add Claimant Snapshot and Complete Claim Data Storage

  ## Overview
  This migration adds comprehensive data storage to prevent data loss and ensure
  all submitted information is captured and retrievable.

  ## Changes
  
  ### New Columns
  1. `claimant_snapshot` (jsonb)
     - Stores the complete claimant profile at time of submission
     - Includes: full_name, cell_number, email, id_number, policy_number
     - Ensures broker always sees correct submitter info even if profile changes
  
  2. `claim_data` (jsonb)
     - Stores the COMPLETE claim payload as submitted
     - Every form field, nested object, array - everything
     - Allows dynamic rendering without hardcoded field mappings
     - Never loses data due to schema mismatches
  
  ## Benefits
  - No more "Unknown Client" in broker dashboard
  - PDF generation captures 100% of submitted data
  - Broker view shows every single field submitted
  - Future-proof: new claim types work automatically
*/

-- Add claimant_snapshot column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'claimant_snapshot'
  ) THEN
    ALTER TABLE claims ADD COLUMN claimant_snapshot jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add claim_data column for complete payload storage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'claim_data'
  ) THEN
    ALTER TABLE claims ADD COLUMN claim_data jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create index for faster queries on claimant_snapshot
CREATE INDEX IF NOT EXISTS idx_claims_claimant_snapshot ON claims USING gin(claimant_snapshot);

-- Create index for faster queries on claim_data
CREATE INDEX IF NOT EXISTS idx_claims_claim_data ON claims USING gin(claim_data);
