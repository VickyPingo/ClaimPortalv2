/*
  # Fix client_profiles INSERT policy for self-registration

  1. Changes
    - Add INSERT policy allowing clients to create their own profile during signup
    - Ensures the profile id matches their auth.uid()
  
  2. Security
    - Users can only create a profile for themselves (id must equal auth.uid())
    - brokerage_id can be set during creation (will be null for direct signups)
*/

-- Add policy for clients to insert their own profile
CREATE POLICY "Clients can create own profile"
  ON client_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
