/*
  # Fix Invitations RLS for Super Admin Access

  1. Changes
    - Enable RLS on invitations table
    - Drop any conflicting old policies
    - Create comprehensive policy for super admins to have full access (INSERT, SELECT, UPDATE, DELETE)
    
  2. Security
    - Super admins (identified by role = 'super_admin' in profiles table) get full access
    - Uses proper authentication check via auth.uid()
*/

-- 1. Ensure RLS is active
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- 2. Drop any old, broken policies to start fresh
DROP POLICY IF EXISTS "Super admins can manage invitations" ON invitations;
DROP POLICY IF EXISTS "Super admins can create invitations" ON invitations;

-- 3. Create the definitive policy for INSERT, SELECT, UPDATE, and DELETE
CREATE POLICY "Super admin full access on invitations"
ON invitations
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM broker_profiles
    WHERE broker_profiles.id = auth.uid()
    AND broker_profiles.role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM broker_profiles
    WHERE broker_profiles.id = auth.uid()
    AND broker_profiles.role = 'super_admin'
  )
);