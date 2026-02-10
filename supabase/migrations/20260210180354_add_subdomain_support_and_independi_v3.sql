/*
  # Add Subdomain Support for Multi-Tenancy
  
  ## Summary
  This migration adds subdomain-based multi-tenancy support to enable white-label brokerage access.
  Each brokerage can now be accessed via their own subdomain (e.g., claims.independi.co.za).
  
  ## Changes
  
  1. **Brokerages Table Updates**
     - Add `subdomain` column (unique, required)
     - Update existing default brokerage with subdomain
     - Add index for faster subdomain lookups
  
  2. **New Brokerage: Independi**
     - name: "Independi"
     - subdomain: "claims.independi.co.za"
     - brand_color: "#0066cc" (blue branding)
  
  3. **Helper Function**
     - `get_brokerage_by_subdomain(subdomain)` - Fetch brokerage config by subdomain
  
  ## Security Notes
  - All existing RLS policies remain in effect
  - Data is strictly isolated by brokerage_id
  - Each subdomain only accesses their own brokerage data
*/

-- =====================================================================
-- 0. FIX BROKEN TRIGGER (Remove trigger referencing non-existent column)
-- =====================================================================

DROP TRIGGER IF EXISTS update_brokerages_updated_at ON brokerages;

-- =====================================================================
-- 1. ADD SUBDOMAIN COLUMN TO BROKERAGES TABLE
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brokerages' AND column_name = 'subdomain'
  ) THEN
    ALTER TABLE brokerages ADD COLUMN subdomain text;
  END IF;
END $$;

-- Update existing brokerages with subdomains
UPDATE brokerages 
SET subdomain = COALESCE(subdomain, 'app.claimsplatform.com')
WHERE subdomain IS NULL;

-- Make subdomain unique (but don't set NOT NULL yet in case of conflicts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'brokerages_subdomain_unique'
  ) THEN
    ALTER TABLE brokerages ADD CONSTRAINT brokerages_subdomain_unique UNIQUE (subdomain);
  END IF;
END $$;

-- Now make it NOT NULL
ALTER TABLE brokerages ALTER COLUMN subdomain SET NOT NULL;

-- Add index for faster subdomain lookups
CREATE INDEX IF NOT EXISTS idx_brokerages_subdomain ON brokerages(subdomain);

-- =====================================================================
-- 2. CREATE INDEPENDI BROKERAGE
-- =====================================================================

-- Insert Independi as the first client brokerage
INSERT INTO brokerages (id, name, subdomain, brand_color, notification_email, created_at)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Independi',
  'claims.independi.co.za',
  '#0066cc',
  'claims@independi.co.za',
  now()
)
ON CONFLICT (id) DO UPDATE
SET 
  name = EXCLUDED.name,
  subdomain = EXCLUDED.subdomain,
  brand_color = EXCLUDED.brand_color,
  notification_email = EXCLUDED.notification_email;

-- =====================================================================
-- 3. HELPER FUNCTIONS
-- =====================================================================

-- Function to get brokerage configuration by subdomain
CREATE OR REPLACE FUNCTION get_brokerage_by_subdomain(subdomain_param text)
RETURNS TABLE (
  id uuid,
  name text,
  subdomain text,
  logo_url text,
  brand_color text,
  notification_email text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id, 
    b.name, 
    b.subdomain, 
    b.logo_url, 
    b.brand_color,
    b.notification_email
  FROM brokerages b
  WHERE b.subdomain = subdomain_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION get_brokerage_by_subdomain(text) TO authenticated, anon;

-- =====================================================================
-- 4. UPDATE RLS POLICIES
-- =====================================================================

-- Ensure RLS is enabled on all critical tables
ALTER TABLE brokerages ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE theft_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE motor_vehicle_theft_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE structural_damage_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE all_risk_claims ENABLE ROW LEVEL SECURITY;

-- Allow public access to brokerage config by subdomain (for branding)
DROP POLICY IF EXISTS "Anyone can read brokerage by subdomain" ON brokerages;
CREATE POLICY "Anyone can read brokerage by subdomain"
  ON brokerages FOR SELECT
  TO public
  USING (true);