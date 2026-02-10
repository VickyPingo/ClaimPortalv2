-- ================================================
-- SUPER ADMIN ROLE VERIFICATION & FIX SCRIPT
-- ================================================
-- Run these queries in your Supabase SQL Editor
-- ================================================

-- STEP 1: Check your current role
-- Replace 'your-email@example.com' with your actual email
SELECT
  bp.id as user_id,
  au.email,
  bp.full_name,
  bp.role as current_role,
  bp.brokerage_id,
  bu.role as broker_user_role,
  CASE
    WHEN bp.role = 'super_admin' THEN '✓ IS SUPER ADMIN'
    WHEN bp.role IS NULL THEN '✗ NO ROLE SET'
    ELSE '✗ NOT SUPER ADMIN'
  END as status
FROM auth.users au
LEFT JOIN broker_profiles bp ON bp.id = au.id
LEFT JOIN broker_users bu ON bu.id = au.id
WHERE au.email = 'your-email@example.com';

-- ================================================
-- If the query above shows your role is NOT 'super_admin',
-- run ONE of the commands below to fix it:
-- ================================================

-- OPTION 1: Update by email (easiest)
-- Replace 'your-email@example.com' with your actual email
UPDATE broker_profiles
SET role = 'super_admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'your-email@example.com'
);

-- OPTION 2: Update by user ID (if you know your ID)
-- Replace 'your-user-id' with your actual user ID from Step 1
UPDATE broker_profiles
SET role = 'super_admin'
WHERE id = 'your-user-id';

-- ================================================
-- STEP 2: Verify the update worked
-- ================================================
SELECT
  bp.id,
  au.email,
  bp.full_name,
  bp.role,
  CASE
    WHEN bp.role = 'super_admin' THEN '✓ SUCCESS - You are now super admin!'
    ELSE '✗ FAILED - Role not updated'
  END as result
FROM auth.users au
JOIN broker_profiles bp ON bp.id = au.id
WHERE au.email = 'your-email@example.com';

-- ================================================
-- STEP 3: List all super admins (optional)
-- ================================================
SELECT
  bp.id,
  au.email,
  bp.full_name,
  bp.role,
  bp.created_at
FROM broker_profiles bp
JOIN auth.users au ON au.id = bp.id
WHERE bp.role = 'super_admin'
ORDER BY bp.created_at DESC;

-- ================================================
-- TROUBLESHOOTING QUERIES
-- ================================================

-- Check if user exists in broker_users table
SELECT * FROM broker_users WHERE id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);

-- Check if profile exists
SELECT * FROM broker_profiles WHERE id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);

-- If profile doesn't exist, you may need to create it
-- But this should normally be done through the signup flow
