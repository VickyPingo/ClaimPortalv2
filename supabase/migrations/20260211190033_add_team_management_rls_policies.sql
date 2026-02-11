/*
  # Team Management RLS Policies

  1. Purpose
    - Enable brokers to view and manage their team members
    - Restrict access to only team members within the same brokerage
    - Prevent cross-brokerage data access

  2. Changes
    - Add RLS policy for brokers to SELECT team members in their brokerage
    - Super admins retain full access to all profiles

  3. Security
    - Brokers can only view profiles with matching brokerage_id
    - Super admins bypass brokerage restrictions
    - Authenticated access required
*/

-- Policy: Brokers can view team members in their own brokerage
CREATE POLICY "Brokers can view team members in their brokerage"
  ON broker_profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Super admins can see all profiles
    EXISTS (
      SELECT 1 FROM broker_profiles bp
      WHERE bp.id = auth.uid()
      AND bp.role = 'super_admin'
    )
    OR
    -- Brokers can see profiles in their own brokerage
    EXISTS (
      SELECT 1 FROM broker_profiles bp
      WHERE bp.id = auth.uid()
      AND bp.brokerage_id = broker_profiles.brokerage_id
    )
  );
