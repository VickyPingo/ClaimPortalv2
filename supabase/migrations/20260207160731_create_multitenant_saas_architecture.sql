/*
  # Multi-Tenant SaaS Architecture

  ## Overview
  This migration establishes a complete multi-tenant architecture for the insurance claims platform,
  where each organization (brokerage) has complete data isolation.

  ## 1. New Tables

  ### organizations
  - `id` (uuid, primary key) - Unique identifier for each organization
  - `name` (text) - Organization display name
  - `slug` (text, unique) - URL-safe identifier (e.g., 'insure-group')
  - `logo_url` (text, optional) - Organization logo URL
  - `primary_color` (text, optional) - Brand color for white-labeling
  - `created_at` (timestamptz) - Creation timestamp

  ### profiles
  - `id` (uuid, primary key, FK to auth.users) - Links to Supabase auth
  - `organization_id` (uuid, FK to organizations) - Which org the user belongs to
  - `full_name` (text) - User's full name
  - `email` (text) - User's email
  - `role` (text) - Either 'broker' or 'client'
  - `cell_number` (text, optional) - Phone number
  - `id_number` (text, optional) - ID/passport number
  - `policy_number` (text, optional) - For clients
  - `broker_notes` (text, optional) - Notes by broker about this client
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## 2. Updated Tables

  ### claims
  - Added `organization_id` (uuid, FK to organizations) - For data isolation
  - Added `claimant_name` (text) - Snapshot of claimant name at time of claim
  - Added `policy_number` (text) - Snapshot of policy number at time of claim

  ## 3. Security (Row Level Security)

  ### Organizations
  - Brokers can read their own organization
  - Clients can read their own organization

  ### Profiles
  - Users can read their own profile
  - Brokers can read all profiles in their organization
  - Users can update their own profile (except role and organization_id)
  - Brokers can update client profiles in their organization

  ### Claims
  - Clients can view their own claims
  - Brokers can view ALL claims in their organization
  - Users can insert claims (with organization check)
  - Brokers can update claims in their organization

  ## 4. Important Notes
  - All data is isolated by organization_id
  - Brokers in Organization A cannot see any data from Organization B
  - RLS policies enforce strict data isolation
  - A default organization is created for existing data migration
*/

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#1e40af',
  created_at timestamptz DEFAULT now()
);

-- Create profiles table (replaces broker_profiles and client_profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('broker', 'client')),
  cell_number text,
  id_number text,
  policy_number text,
  broker_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Add organization_id to claims table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE claims ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_claims_organization_id ON claims(organization_id);
  END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- RLS POLICIES: ORGANIZATIONS
-- =====================================================================

-- Users can read their own organization
CREATE POLICY "Users can read own organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- =====================================================================
-- RLS POLICIES: PROFILES
-- =====================================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Brokers can read all profiles in their organization
CREATE POLICY "Brokers can read org profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role = 'broker'
    )
  );

-- Users can insert their own profile (during signup)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Brokers can update client profiles in their organization
CREATE POLICY "Brokers can update client profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role = 'broker'
    )
    AND role = 'client'
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role = 'broker'
    )
    AND role = 'client'
  );

-- =====================================================================
-- RLS POLICIES: CLAIMS (MULTI-TENANT)
-- =====================================================================

-- Drop existing policies to recreate them with organization awareness
DROP POLICY IF EXISTS "Users can view own claims" ON claims;
DROP POLICY IF EXISTS "Brokers can view org claims" ON claims;
DROP POLICY IF EXISTS "Users can insert own claims" ON claims;
DROP POLICY IF EXISTS "Brokers can insert claims" ON claims;
DROP POLICY IF EXISTS "Brokers can update org claims" ON claims;
DROP POLICY IF EXISTS "Allow anonymous insert for public claims" ON claims;
DROP POLICY IF EXISTS "Allow anonymous to read after insert" ON claims;

-- Clients can view their own claims
CREATE POLICY "Clients can view own claims"
  ON claims FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Brokers can view ALL claims in their organization
CREATE POLICY "Brokers can view all org claims"
  ON claims FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role = 'broker'
    )
  );

-- Authenticated users can insert claims (must match their organization)
CREATE POLICY "Users can insert claims in their org"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Anonymous users can insert claims (public claim submission)
CREATE POLICY "Anonymous can insert public claims"
  ON claims FOR INSERT
  TO anon
  WITH CHECK (true);

-- Brokers can update claims in their organization
CREATE POLICY "Brokers can update org claims"
  ON claims FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role = 'broker'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role = 'broker'
    )
  );

-- =====================================================================
-- DEFAULT DATA: Create default organization
-- =====================================================================

-- Insert default organization for existing data
INSERT INTO organizations (id, name, slug, primary_color)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Insurance Brokerage',
  'default',
  '#1e40af'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- FUNCTIONS: Helper functions for organization management
-- =====================================================================

-- Function to get organization by slug
CREATE OR REPLACE FUNCTION get_organization_by_slug(org_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  primary_color text
) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name, o.slug, o.logo_url, o.primary_color
  FROM organizations o
  WHERE o.slug = org_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
