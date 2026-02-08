/*
  # Fix Remaining Security Issues

  ## Changes

  1. **Consolidate Multiple Permissive Policies**
    - Merge multiple SELECT policies into single policies per table
    - Tables affected: claims, motor_vehicle_theft_claims, theft_claims
    - This eliminates confusion and makes security logic clearer

  2. **Fix Function Search Path**
    - Set immutable search_path on update_updated_at_column function
    - Prevents security issues from search_path manipulation

  ## Security Improvements
    - Single source of truth for SELECT permissions per table
    - Protected function against search_path attacks
*/

-- ============================================================================
-- 1. CONSOLIDATE MULTIPLE PERMISSIVE POLICIES - CLAIMS TABLE
-- ============================================================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view claims" ON claims;
DROP POLICY IF EXISTS "Clients can view own claims" ON claims;

-- Create single consolidated SELECT policy
CREATE POLICY "Users can view relevant claims"
  ON claims
  FOR SELECT
  TO authenticated
  USING (
    -- Clients can view their own claims
    client_id = (select auth.uid())
    OR
    -- Brokers can view claims in their brokerage
    EXISTS (
      SELECT 1 FROM broker_users
      WHERE broker_users.id = (select auth.uid())
      AND broker_users.brokerage_id = claims.brokerage_id
    )
  );

-- ============================================================================
-- 2. CONSOLIDATE MULTIPLE PERMISSIVE POLICIES - MOTOR VEHICLE THEFT CLAIMS
-- ============================================================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view own motor vehicle theft claims" ON motor_vehicle_theft_claims;
DROP POLICY IF EXISTS "Brokers can view motor vehicle theft claims in their brokerage" ON motor_vehicle_theft_claims;

-- Create single consolidated SELECT policy
CREATE POLICY "Users can view relevant motor vehicle theft claims"
  ON motor_vehicle_theft_claims
  FOR SELECT
  TO authenticated
  USING (
    -- Clients can view their own claims
    client_id = (select auth.uid())
    OR
    -- Brokers can view claims in their brokerage
    EXISTS (
      SELECT 1 FROM broker_users
      WHERE broker_users.id = (select auth.uid())
      AND broker_users.brokerage_id = motor_vehicle_theft_claims.brokerage_id
    )
  );

-- ============================================================================
-- 3. CONSOLIDATE MULTIPLE PERMISSIVE POLICIES - THEFT CLAIMS
-- ============================================================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Broker users can view own brokerage theft claims" ON theft_claims;
DROP POLICY IF EXISTS "Clients can view own theft claims" ON theft_claims;

-- Create single consolidated SELECT policy
CREATE POLICY "Users can view relevant theft claims"
  ON theft_claims
  FOR SELECT
  TO authenticated
  USING (
    -- Clients can view their own claims
    client_id = (select auth.uid())
    OR
    -- Brokers can view claims in their brokerage
    EXISTS (
      SELECT 1 FROM broker_users
      WHERE broker_users.id = (select auth.uid())
      AND broker_users.brokerage_id = theft_claims.brokerage_id
    )
  );

-- ============================================================================
-- 4. FIX FUNCTION SEARCH PATH
-- ============================================================================

-- Drop and recreate function with immutable search_path
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers that used this function
DROP TRIGGER IF EXISTS update_brokerages_updated_at ON brokerages;
CREATE TRIGGER update_brokerages_updated_at
  BEFORE UPDATE ON brokerages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_claims_updated_at ON claims;
CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_theft_claims_updated_at ON theft_claims;
CREATE TRIGGER update_theft_claims_updated_at
  BEFORE UPDATE ON theft_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_motor_vehicle_theft_claims_updated_at ON motor_vehicle_theft_claims;
CREATE TRIGGER update_motor_vehicle_theft_claims_updated_at
  BEFORE UPDATE ON motor_vehicle_theft_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
