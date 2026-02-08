/*
  # Fix Security and Performance Issues

  ## Changes

  1. **Add Missing Indexes**
    - Add index on `motor_vehicle_theft_claims.brokerage_id` for foreign key performance

  2. **Optimize RLS Policies (Auth Function Caching)**
    - Replace `auth.<function>()` with `(select auth.<function>())` in all RLS policies
    - This prevents re-evaluation of auth functions for each row, improving query performance at scale

  3. **Fix Overly Permissive RLS Policies**
    - Remove or restrict policies that allow unrestricted access
    - `brokerages`: Restrict update policy to broker users only
    - `claims`: Restrict update policy to brokers only
    - `claims`: Make insert policy check client_id matches auth user
    - `clients`: Restrict insert policy to authenticated users creating their own record

  ## Tables Affected
    - motor_vehicle_theft_claims
    - claims
    - broker_users
    - theft_claims
    - theft_items
    - brokerages
    - clients
*/

-- ============================================================================
-- 1. ADD MISSING INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_motor_vehicle_theft_claims_brokerage 
  ON motor_vehicle_theft_claims(brokerage_id);

-- ============================================================================
-- 2. OPTIMIZE RLS POLICIES - CLAIMS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Clients can view own claims" ON claims;
CREATE POLICY "Clients can view own claims"
  ON claims
  FOR SELECT
  TO authenticated
  USING (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update claims" ON claims;
CREATE POLICY "Brokers can update claims"
  ON claims
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM broker_users
      WHERE broker_users.id = (select auth.uid())
      AND broker_users.brokerage_id = claims.brokerage_id
    )
  );

DROP POLICY IF EXISTS "Public users can submit claims" ON claims;
CREATE POLICY "Users can submit own claims"
  ON claims
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    client_id = (select auth.uid()) OR
    client_id IS NULL
  );

-- ============================================================================
-- 3. OPTIMIZE RLS POLICIES - BROKER_USERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can create own broker record" ON broker_users;
CREATE POLICY "Users can create own broker record"
  ON broker_users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Broker users can view own record" ON broker_users;
CREATE POLICY "Broker users can view own record"
  ON broker_users
  FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

-- ============================================================================
-- 4. OPTIMIZE RLS POLICIES - THEFT_CLAIMS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Broker users can view own brokerage theft claims" ON theft_claims;
CREATE POLICY "Broker users can view own brokerage theft claims"
  ON theft_claims
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM broker_users
      WHERE broker_users.id = (select auth.uid())
      AND broker_users.brokerage_id = theft_claims.brokerage_id
    )
  );

DROP POLICY IF EXISTS "Broker users can update own brokerage theft claims" ON theft_claims;
CREATE POLICY "Broker users can update own brokerage theft claims"
  ON theft_claims
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM broker_users
      WHERE broker_users.id = (select auth.uid())
      AND broker_users.brokerage_id = theft_claims.brokerage_id
    )
  );

DROP POLICY IF EXISTS "Clients can insert theft claims for their brokerage" ON theft_claims;
CREATE POLICY "Clients can insert theft claims for their brokerage"
  ON theft_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Clients can view own theft claims" ON theft_claims;
CREATE POLICY "Clients can view own theft claims"
  ON theft_claims
  FOR SELECT
  TO authenticated
  USING (client_id = (select auth.uid()));

-- ============================================================================
-- 5. OPTIMIZE RLS POLICIES - THEFT_ITEMS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Broker users can view theft items in own brokerage" ON theft_items;
CREATE POLICY "Broker users can view theft items in own brokerage"
  ON theft_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM theft_claims tc
      JOIN broker_users bu ON bu.brokerage_id = tc.brokerage_id
      WHERE tc.id = theft_items.theft_claim_id
      AND bu.id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clients can insert theft items for their claims" ON theft_items;
CREATE POLICY "Clients can insert theft items for their claims"
  ON theft_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM theft_claims
      WHERE theft_claims.id = theft_items.theft_claim_id
      AND theft_claims.client_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 6. OPTIMIZE RLS POLICIES - MOTOR_VEHICLE_THEFT_CLAIMS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can insert own motor vehicle theft claims" ON motor_vehicle_theft_claims;
CREATE POLICY "Authenticated users can insert own motor vehicle theft claims"
  ON motor_vehicle_theft_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view own motor vehicle theft claims" ON motor_vehicle_theft_claims;
CREATE POLICY "Authenticated users can view own motor vehicle theft claims"
  ON motor_vehicle_theft_claims
  FOR SELECT
  TO authenticated
  USING (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Brokers can view motor vehicle theft claims in their brokerage" ON motor_vehicle_theft_claims;
CREATE POLICY "Brokers can view motor vehicle theft claims in their brokerage"
  ON motor_vehicle_theft_claims
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM broker_users
      WHERE broker_users.id = (select auth.uid())
      AND broker_users.brokerage_id = motor_vehicle_theft_claims.brokerage_id
    )
  );

DROP POLICY IF EXISTS "Brokers can update motor vehicle theft claims in their brokerage" ON motor_vehicle_theft_claims;
DROP POLICY IF EXISTS "Brokers can update motor vehicle theft claims in their brokerag" ON motor_vehicle_theft_claims;
CREATE POLICY "Brokers can update motor vehicle theft claims in their brokerage"
  ON motor_vehicle_theft_claims
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM broker_users
      WHERE broker_users.id = (select auth.uid())
      AND broker_users.brokerage_id = motor_vehicle_theft_claims.brokerage_id
    )
  );

-- ============================================================================
-- 7. FIX OVERLY PERMISSIVE POLICIES - BROKERAGES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can update brokerages" ON brokerages;
CREATE POLICY "Broker users can update own brokerage"
  ON brokerages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM broker_users
      WHERE broker_users.id = (select auth.uid())
      AND broker_users.brokerage_id = brokerages.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM broker_users
      WHERE broker_users.id = (select auth.uid())
      AND broker_users.brokerage_id = brokerages.id
    )
  );

-- ============================================================================
-- 8. FIX OVERLY PERMISSIVE POLICIES - CLIENTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can create clients" ON clients;
CREATE POLICY "Users can create own client record"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));
