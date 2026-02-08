/*
  # Fix Broker Users RLS Policies

  ## Changes
  Updates RLS policies to allow broker users to be created during signup.

  ## 1. Policy Updates
  - Allow authenticated users to insert their own broker_user record
  - Existing policies remain for viewing brokerage staff

  ## 2. Security
  - Users can only create a broker_user record with their own auth.uid()
  - Prevents unauthorized access or privilege escalation
*/

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Broker users can view own record" ON broker_users;

-- Allow users to insert their own broker_user record during signup
CREATE POLICY "Users can create own broker record"
  ON broker_users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Allow users to view their own broker_user record
CREATE POLICY "Broker users can view own record"
  ON broker_users FOR SELECT
  TO authenticated
  USING (id = auth.uid());
