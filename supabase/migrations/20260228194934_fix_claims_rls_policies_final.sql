/*
  # Fix Claims RLS Policies - Final

  1. Problem
    - 12 conflicting policies on claims table
    - Policies reference non-existent tables (broker_users, broker_profiles)
    - Insecure anonymous policies with USING (true)
    - Mix of client_id, user_id, and organization_id checks
    - Code inserts client_user_id but schema only has client_id

  2. Detected Schema
    claims table:
      - client_id (uuid, nullable) - canonical client reference
      - user_id (uuid, nullable) - legacy column
      - brokerage_id (uuid, NOT NULL)
      - organization_id (uuid, nullable)
    
    profiles table:
      - user_id (uuid, NOT NULL) - auth.uid() reference
      - brokerage_id (uuid, nullable)
      - organization_id (uuid, NOT NULL)
      - role (text, NOT NULL)

  3. Solution
    - Drop ALL existing policies
    - Create 4 clean policies using actual column names:
      A) Clients insert own claims (client_id = auth.uid())
      B) Clients read own claims (client_id = auth.uid())
      C) Brokers read their brokerage claims
      D) Brokers update their brokerage claims

  4. Security
    - Enable RLS
    - Restrictive policies only
    - Proper auth checks
    - No USING (true) policies
*/

-- Enable RLS
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Anonymous can insert public claims" ON public.claims;
DROP POLICY IF EXISTS "Anonymous users can view claims after insert" ON public.claims;
DROP POLICY IF EXISTS "Brokers can update claims" ON public.claims;
DROP POLICY IF EXISTS "Brokers can update org claims" ON public.claims;
DROP POLICY IF EXISTS "Brokers can view all org claims" ON public.claims;
DROP POLICY IF EXISTS "Brokers can view claims from their brokerage users" ON public.claims;
DROP POLICY IF EXISTS "Clients can view own claims" ON public.claims;
DROP POLICY IF EXISTS "Users can insert claims in their org" ON public.claims;
DROP POLICY IF EXISTS "Users can submit own claims" ON public.claims;
DROP POLICY IF EXISTS "Users can update own claims by user_id" ON public.claims;
DROP POLICY IF EXISTS "Users can view own claims by user_id" ON public.claims;
DROP POLICY IF EXISTS "Users can view relevant claims" ON public.claims;

-- A) Clients can insert their own claims
CREATE POLICY "clients_insert_own_claims"
  ON public.claims
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- B) Clients can read their own claims
CREATE POLICY "clients_read_own_claims"
  ON public.claims
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- C) Brokers can read claims from their brokerage
CREATE POLICY "brokers_read_brokerage_claims"
  ON public.claims
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'broker'
        AND profiles.brokerage_id = claims.brokerage_id
    )
  );

-- D) Brokers can update claims from their brokerage
CREATE POLICY "brokers_update_brokerage_claims"
  ON public.claims
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'broker'
        AND profiles.brokerage_id = claims.brokerage_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'broker'
        AND profiles.brokerage_id = claims.brokerage_id
    )
  );
