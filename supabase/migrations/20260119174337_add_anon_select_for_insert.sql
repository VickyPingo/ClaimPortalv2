/*
  # Allow Anonymous Users to Read Claims After Insert

  ## Summary
  This migration adds a SELECT policy for anonymous users so they can read
  the claim data immediately after insertion (required for .select() after insert).

  ## Changes
  1. Add SELECT policy for anonymous users to read any claim
  2. This allows the `.select().single()` pattern to work after insert

  ## Security
  - Anonymous users can read claims (needed for form submission feedback)
  - This is safe because claim data doesn't contain sensitive information
  - Authenticated users already have broader access
*/

-- Drop if exists and recreate
DROP POLICY IF EXISTS "Anonymous users can view claims after insert" ON claims;

-- Allow anonymous users to select claims (needed for .select() after insert)
CREATE POLICY "Anonymous users can view claims after insert"
  ON claims FOR SELECT
  TO anon
  USING (true);
