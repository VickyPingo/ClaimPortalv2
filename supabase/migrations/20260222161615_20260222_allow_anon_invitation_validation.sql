/*
  # Allow Anonymous Invitation Validation

  1. Security
    - Add policy to allow anonymous users to SELECT from invitations table
    - This is required for the signup flow where unauthenticated users need to validate their invitation token
    - Policy is restricted to only reading invitation data (no writes)
    - Users will only be able to query invitations by token (query pattern in application)
*/

-- Drop policy if it exists first
DROP POLICY IF EXISTS "Allow anonymous invitation validation" ON invitations;

-- Allow anonymous users to read invitations for validation during signup
CREATE POLICY "Allow anonymous invitation validation"
  ON invitations
  FOR SELECT
  TO anon
  USING (true);
