/*
  # Add brokerage_id to profiles table

  1. Changes
    - Add `brokerage_id` column to profiles table
    - Make it nullable initially to allow existing data
    - Add foreign key constraint to brokerages table
    - Create index for faster lookups
    
  2. Notes
    - This allows profiles to reference brokerages directly
    - Existing profiles will have NULL brokerage_id until updated
*/

-- Add brokerage_id column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'brokerage_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN brokerage_id uuid REFERENCES brokerages(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_profiles_brokerage_id ON profiles(brokerage_id);
  END IF;
END $$;
