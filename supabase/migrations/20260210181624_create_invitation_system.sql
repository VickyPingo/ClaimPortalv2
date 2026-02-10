/*
  # Create Invitation System for Brokerages
  
  ## Summary
  This migration creates a secure invitation system that allows brokerages to generate
  invite links for onboarding employees without manual database entry.
  
  ## Changes
  
  1. **New Table: invitations**
     - `id` (uuid, primary key)
     - `token` (text, unique) - Secure random token for the invite link
     - `brokerage_id` (uuid, FK) - Which brokerage this invitation is for
     - `role` (text) - Role to assign (e.g., 'admin', 'agent', 'staff')
     - `expires_at` (timestamptz) - When this invitation expires
     - `used_count` (integer) - How many people have used this invitation
     - `max_uses` (integer, nullable) - Maximum number of uses (NULL = unlimited)
     - `is_active` (boolean) - Whether the invitation is still active
     - `created_by` (uuid, nullable) - Who created this invitation
     - `created_at` (timestamptz) - When created
     - `updated_at` (timestamptz) - Last updated
  
  2. **Helper Functions**
     - `generate_invitation_token()` - Generates a secure random token
     - `validate_invitation(token, subdomain)` - Validates an invitation token
     - `use_invitation(token)` - Increments usage count when someone signs up
  
  3. **RLS Policies**
     - Brokers can create invitations for their brokerage
     - Brokers can view their brokerage's invitations
     - Public can validate invitations (read-only, for signup flow)
  
  ## Security Notes
  - Tokens are cryptographically secure random strings
  - Invitations expire after a set time period
  - Can limit number of uses per invitation
  - Cannot be used across different brokerages (subdomain validation)
*/

-- =====================================================================
-- 1. CREATE INVITATIONS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64'),
  brokerage_id uuid NOT NULL REFERENCES brokerages(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_count integer NOT NULL DEFAULT 0,
  max_uses integer,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_brokerage_id ON invitations(brokerage_id);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);

-- Add constraint for valid roles
ALTER TABLE invitations ADD CONSTRAINT invitations_role_check 
  CHECK (role IN ('admin', 'agent', 'staff', 'broker'));

-- =====================================================================
-- 2. HELPER FUNCTIONS
-- =====================================================================

-- Function to generate a clean invitation token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS text AS $$
BEGIN
  RETURN replace(encode(gen_random_bytes(24), 'base64'), '/', '_');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate an invitation token
CREATE OR REPLACE FUNCTION validate_invitation(
  token_param text,
  subdomain_param text DEFAULT NULL
)
RETURNS TABLE (
  invitation_id uuid,
  brokerage_id uuid,
  brokerage_name text,
  brokerage_subdomain text,
  role text,
  is_valid boolean,
  error_message text
) AS $$
DECLARE
  inv_record RECORD;
  brok_record RECORD;
BEGIN
  -- Find the invitation
  SELECT * INTO inv_record
  FROM invitations
  WHERE token = token_param;
  
  -- Check if invitation exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::text,
      false, 'Invalid invitation token';
    RETURN;
  END IF;
  
  -- Get brokerage info
  SELECT * INTO brok_record
  FROM brokerages
  WHERE id = inv_record.brokerage_id;
  
  -- Validate subdomain matches (if provided)
  IF subdomain_param IS NOT NULL AND brok_record.subdomain != subdomain_param THEN
    RETURN QUERY SELECT 
      inv_record.id, inv_record.brokerage_id, brok_record.name, 
      brok_record.subdomain, inv_record.role,
      false, 'This invitation is not valid for this domain';
    RETURN;
  END IF;
  
  -- Check if invitation is active
  IF NOT inv_record.is_active THEN
    RETURN QUERY SELECT 
      inv_record.id, inv_record.brokerage_id, brok_record.name, 
      brok_record.subdomain, inv_record.role,
      false, 'This invitation has been deactivated';
    RETURN;
  END IF;
  
  -- Check if invitation has expired
  IF inv_record.expires_at < now() THEN
    RETURN QUERY SELECT 
      inv_record.id, inv_record.brokerage_id, brok_record.name, 
      brok_record.subdomain, inv_record.role,
      false, 'This invitation has expired';
    RETURN;
  END IF;
  
  -- Check if invitation has reached max uses
  IF inv_record.max_uses IS NOT NULL AND inv_record.used_count >= inv_record.max_uses THEN
    RETURN QUERY SELECT 
      inv_record.id, inv_record.brokerage_id, brok_record.name, 
      brok_record.subdomain, inv_record.role,
      false, 'This invitation has reached its maximum number of uses';
    RETURN;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT 
    inv_record.id, inv_record.brokerage_id, brok_record.name, 
    brok_record.subdomain, inv_record.role,
    true, NULL::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage count when invitation is used
CREATE OR REPLACE FUNCTION use_invitation(token_param text)
RETURNS boolean AS $$
DECLARE
  inv_id uuid;
BEGIN
  -- Find and update the invitation
  UPDATE invitations
  SET 
    used_count = used_count + 1,
    updated_at = now()
  WHERE token = token_param
    AND is_active = true
    AND expires_at > now()
    AND (max_uses IS NULL OR used_count < max_uses)
  RETURNING id INTO inv_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 3. ROW LEVEL SECURITY
-- =====================================================================

-- Enable RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Brokers can view invitations for their brokerage
DROP POLICY IF EXISTS "Brokers can view org invitations" ON invitations;
CREATE POLICY "Brokers can view org invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_profiles
      WHERE id = auth.uid()
    )
  );

-- Brokers can create invitations for their brokerage
DROP POLICY IF EXISTS "Brokers can create org invitations" ON invitations;
CREATE POLICY "Brokers can create org invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_profiles
      WHERE id = auth.uid()
    )
  );

-- Brokers can update their brokerage's invitations
DROP POLICY IF EXISTS "Brokers can update org invitations" ON invitations;
CREATE POLICY "Brokers can update org invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_profiles
      WHERE id = auth.uid()
    )
  );

-- Public can validate invitations (needed for signup flow)
-- Note: This only allows calling the validation function, not direct table access
GRANT EXECUTE ON FUNCTION validate_invitation(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION use_invitation(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_invitation_token() TO authenticated;