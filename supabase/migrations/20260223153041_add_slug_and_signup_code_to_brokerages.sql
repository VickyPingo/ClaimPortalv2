/*
  # Add slug and signup_code columns to brokerages

  ## Summary
  This migration updates the brokerages table to use subdomain slugs instead of full custom domains.
  Each organisation now uses a subdomain of claimsportal.co.za (e.g., independi.claimsportal.co.za).

  ## Changes

  1. **New Columns**
     - `slug` (text, unique): Short identifier for subdomain (e.g., "independi")
     - `signup_code` (text): Code for user registration (defaults to slug value)

  2. **Data Migration**
     - Copy existing `subdomain` values to `slug` column
     - Set `signup_code` equal to `slug` for all existing brokerages
     - Update indexes for faster lookups

  ## Notes
  - The `subdomain` column is kept for backward compatibility
  - The slug format is: lowercase letters, numbers, and hyphens only
  - Each organisation's URL will be: https://{slug}.claimsportal.co.za
*/

-- =====================================================================
-- 1. ADD NEW COLUMNS
-- =====================================================================

-- Add slug column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brokerages' AND column_name = 'slug'
  ) THEN
    ALTER TABLE brokerages ADD COLUMN slug text;
  END IF;
END $$;

-- Add signup_code column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brokerages' AND column_name = 'signup_code'
  ) THEN
    ALTER TABLE brokerages ADD COLUMN signup_code text;
  END IF;
END $$;

-- =====================================================================
-- 2. MIGRATE EXISTING DATA
-- =====================================================================

-- Copy subdomain to slug for existing records (if not already set)
UPDATE brokerages 
SET slug = subdomain
WHERE slug IS NULL;

-- Set signup_code equal to slug for existing records (if not already set)
UPDATE brokerages 
SET signup_code = slug
WHERE signup_code IS NULL;

-- =====================================================================
-- 3. ADD CONSTRAINTS AND INDEXES
-- =====================================================================

-- Make slug NOT NULL
ALTER TABLE brokerages ALTER COLUMN slug SET NOT NULL;

-- Add unique constraint on slug
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'brokerages_slug_unique'
  ) THEN
    ALTER TABLE brokerages ADD CONSTRAINT brokerages_slug_unique UNIQUE (slug);
  END IF;
END $$;

-- Add index for faster slug lookups
CREATE INDEX IF NOT EXISTS idx_brokerages_slug ON brokerages(slug);

-- Add index for faster signup_code lookups
CREATE INDEX IF NOT EXISTS idx_brokerages_signup_code ON brokerages(signup_code);

-- =====================================================================
-- 4. UPDATE HELPER FUNCTION TO SUPPORT SLUG
-- =====================================================================

-- Function to get brokerage configuration by slug
CREATE OR REPLACE FUNCTION get_brokerage_by_slug(slug_param text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  subdomain text,
  logo_url text,
  brand_color text,
  notification_email text,
  signup_code text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id, 
    b.name, 
    b.slug,
    b.subdomain, 
    b.logo_url, 
    b.brand_color,
    b.notification_email,
    b.signup_code
  FROM brokerages b
  WHERE b.slug = slug_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION get_brokerage_by_slug(text) TO authenticated, anon;