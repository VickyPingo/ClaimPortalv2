/*
  # Add Super Admin Policies for Invitations and Brokerages

  ## Summary
  This migration adds RLS policies to allow super administrators to view and manage
  all invitations and brokerages across the entire platform.

  ## Changes

  1. **Invitations Policies for Super Admin**
     - Allow super admins to view all invitations
     - Allow super admins to create invitations for any brokerage
     - Allow super admins to update any invitation

  2. **Brokerages Policies for Super Admin**
     - Allow super admins to view all brokerages
     - Allow super admins to create new brokerages
     - Allow super admins to update any brokerage

  ## Security Notes
  - Super admin role is identified by checking broker_profiles.role = 'super_admin'
  - All policies check authentication first
  - Regular brokers can only manage their own brokerage data (existing policies remain)
*/

-- =====================================================================
-- INVITATIONS POLICIES FOR SUPER ADMIN
-- =====================================================================

-- Super admins can view all invitations
DROP POLICY IF EXISTS "Super admins can view all invitations" ON invitations;
CREATE POLICY "Super admins can view all invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM broker_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Super admins can create invitations for any brokerage
DROP POLICY IF EXISTS "Super admins can create invitations" ON invitations;
CREATE POLICY "Super admins can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM broker_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Super admins can update any invitation
DROP POLICY IF EXISTS "Super admins can update invitations" ON invitations;
CREATE POLICY "Super admins can update invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM broker_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =====================================================================
-- BROKERAGES POLICIES FOR SUPER ADMIN
-- =====================================================================

-- Super admins can view all brokerages
DROP POLICY IF EXISTS "Super admins can view all brokerages" ON brokerages;
CREATE POLICY "Super admins can view all brokerages"
  ON brokerages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM broker_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Super admins can create new brokerages
DROP POLICY IF EXISTS "Super admins can create brokerages" ON brokerages;
CREATE POLICY "Super admins can create brokerages"
  ON brokerages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM broker_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Super admins can update any brokerage
DROP POLICY IF EXISTS "Super admins can update brokerages" ON brokerages;
CREATE POLICY "Super admins can update brokerages"
  ON brokerages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM broker_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =====================================================================
-- ALLOW ANYONE TO VIEW THEIR OWN BROKERAGE
-- =====================================================================

-- Brokers can view their own brokerage
DROP POLICY IF EXISTS "Brokers can view own brokerage" ON brokerages;
CREATE POLICY "Brokers can view own brokerage"
  ON brokerages FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT brokerage_id FROM broker_profiles
      WHERE id = auth.uid()
    )
  );
