/*
  # Add user_id column to profiles table

  1. Changes
    - Add `user_id` column to `profiles` table
    - Populate `user_id` with existing `id` values
    - Add unique constraint on `user_id`
    - Add index on `user_id` for faster lookups
  
  2. Notes
    - The `id` column will remain as primary key for now
    - `user_id` will be the new reference to auth.users
    - This allows gradual migration of queries
*/

-- Add user_id column (nullable initially for data migration)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS user_id uuid;

-- Populate user_id with existing id values
UPDATE profiles 
SET user_id = id 
WHERE user_id IS NULL;

-- Make user_id NOT NULL after population
ALTER TABLE profiles 
ALTER COLUMN user_id SET NOT NULL;

-- Add unique constraint on user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_user_id_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Add index on user_id for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);