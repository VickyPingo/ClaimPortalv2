/*
  # Fix Public Claim Submission

  ## Summary
  This migration fixes the RLS policy to allow anonymous users to submit claims.

  ## Changes
  1. Drop and recreate the INSERT policy with proper permissions for anonymous users
  2. Ensure the policy correctly allows public submissions without authentication

  ## Security
  - Anonymous users can INSERT claims (public form submission)
  - Authenticated users can still INSERT, SELECT, and UPDATE claims
  - All other operations remain secured
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Anyone can submit claims" ON claims;

-- Create a new permissive policy for public claim submission
CREATE POLICY "Public users can submit claims"
  ON claims FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
