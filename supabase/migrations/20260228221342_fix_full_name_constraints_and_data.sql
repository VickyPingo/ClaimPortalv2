/*
  # Fix Full Name Data Quality and Constraints

  1. Data Cleanup
    - Backfills NULL or empty full_name with role-based placeholders
    - Replaces email-like full_name (contains '@') with role-based placeholders
    - Backfills claims.claimant_name where it equals claimant_email

  2. Schema Changes
    - Sets default value for full_name to 'Client'
    - Adds NOT NULL constraint to full_name
    - Adds CHECK constraint to prevent email-like values in full_name

  3. Data Integrity
    - All changes are idempotent and safe to re-run
    - Preserves valid existing names
    - Ensures future inserts cannot violate constraints
*/

-- Step 1: Backfill NULL or empty full_name with role-based placeholders
UPDATE profiles
SET full_name = CASE
  WHEN role = 'super_admin' THEN 'Admin'
  WHEN role IN ('broker', 'main_broker', 'admin') THEN 'Broker'
  ELSE 'Client'
END
WHERE full_name IS NULL OR TRIM(full_name) = '';

-- Step 2: Replace email-like full_name (contains '@') with role-based placeholders
UPDATE profiles
SET full_name = CASE
  WHEN role = 'super_admin' THEN 'Admin'
  WHEN role IN ('broker', 'main_broker', 'admin') THEN 'Broker'
  ELSE 'Client'
END
WHERE full_name LIKE '%@%';

-- Step 3: Set default value for full_name
ALTER TABLE profiles
ALTER COLUMN full_name SET DEFAULT 'Client';

-- Step 4: Add NOT NULL constraint (safe because we've backfilled all nulls)
ALTER TABLE profiles
ALTER COLUMN full_name SET NOT NULL;

-- Step 5: Add CHECK constraint to prevent email-like values
-- Drop existing constraint if it exists (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'full_name_not_email' AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT full_name_not_email;
  END IF;
END $$;

-- Add the constraint
ALTER TABLE profiles
ADD CONSTRAINT full_name_not_email CHECK (full_name NOT LIKE '%@%');

-- Step 6: Backfill claims where claimant_name is null, email, or email-like
UPDATE claims
SET claimant_name = COALESCE(p.full_name, 'Client')
FROM profiles p
WHERE claims.user_id = p.user_id
  AND (
    claims.claimant_name IS NULL
    OR claims.claimant_name = claims.claimant_email
    OR claims.claimant_name LIKE '%@%'
  );

-- Step 7: For claims without a matching profile, set placeholder
UPDATE claims
SET claimant_name = 'Client'
WHERE claimant_name IS NULL
  OR claimant_name LIKE '%@%'
  OR claimant_name = claimant_email;
