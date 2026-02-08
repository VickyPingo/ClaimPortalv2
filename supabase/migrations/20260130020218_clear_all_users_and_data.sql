/*
  # Clear all users and related data

  This migration removes all user accounts and associated data to allow fresh signups.
  
  1. Deletes all claims
  2. Deletes all client profiles
  3. Deletes all broker profiles
  4. Deletes all broker users
  5. Deletes all auth users
*/

-- Delete all claims first
DELETE FROM claims;

-- Delete all client profiles
DELETE FROM client_profiles;

-- Delete all broker profiles
DELETE FROM broker_profiles;

-- Delete all broker users
DELETE FROM broker_users;

-- Delete all users from auth.users table
-- This requires service_role permissions
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    DELETE FROM auth.users WHERE id = user_record.id;
  END LOOP;
END $$;
