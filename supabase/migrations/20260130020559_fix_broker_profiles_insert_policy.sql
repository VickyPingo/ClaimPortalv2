/*
  # Fix broker_profiles INSERT policy for self-registration

  1. Changes
    - Add INSERT policy allowing brokers to create their own profile during signup
    - Ensures the profile id matches their auth.uid()
  
  2. Security
    - Users can only create a profile for themselves (id must equal auth.uid())
    - Works alongside the existing policy for brokers in brokerages
*/

-- Add policy for brokers to insert their own profile
CREATE POLICY "Brokers can create own profile"
  ON broker_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
