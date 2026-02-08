/*
  # Add user_id to claims table for client-centric logic

  ## Overview
  This migration adds a `user_id` column to the claims table that directly
  references auth.users.id, enabling strict client-centric claim ownership
  for the Broker Admin Dashboard.

  ## Changes
  1. Add `user_id` column to claims table
     - References auth.users(id) for authenticated client users
     - Nullable to maintain backward compatibility with existing claims
     - Indexed for performance

  2. Update RLS policies
     - Add policies for user_id based access
     - Maintain existing client_id policies for backward compatibility

  3. Purpose
     - Enable direct relationship between claims and authenticated users
     - Support client folder view in admin dashboard
     - Facilitate efficient claim aggregation by user
*/

-- Add user_id column to claims table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE claims ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims(user_id);

-- Add RLS policy for users to view their own claims by user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'claims' AND policyname = 'Users can view own claims by user_id'
  ) THEN
    CREATE POLICY "Users can view own claims by user_id"
      ON claims FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add RLS policy for users to update their own claims by user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'claims' AND policyname = 'Users can update own claims by user_id'
  ) THEN
    CREATE POLICY "Users can update own claims by user_id"
      ON claims FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add RLS policy for brokers to view all claims where user is in their brokerage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'claims' AND policyname = 'Brokers can view claims from their brokerage users'
  ) THEN
    CREATE POLICY "Brokers can view claims from their brokerage users"
      ON claims FOR SELECT
      TO authenticated
      USING (
        brokerage_id IN (
          SELECT brokerage_id FROM broker_profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;