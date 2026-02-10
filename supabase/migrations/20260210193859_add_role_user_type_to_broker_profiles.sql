/*
  # Add Role and User Type to Broker Profiles

  ## Summary
  This migration adds the `role` and `user_type` columns to the broker_profiles table
  to support the super admin role hierarchy and user type identification.

  ## Changes

  1. **Add Columns to broker_profiles**
     - `role` (text) - Broker role: 'super_admin', 'admin', 'agent', 'staff'
     - `user_type` (text) - User type identifier: 'broker'

  ## Security Notes
  - Role determines access level (super_admin has full platform access)
  - User type helps identify broker vs client users
  - Default role is 'staff' for new brokers
*/

-- Add role column to broker_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broker_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE broker_profiles ADD COLUMN role text DEFAULT 'staff';
  END IF;
END $$;

-- Add user_type column to broker_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broker_profiles' AND column_name = 'user_type'
  ) THEN
    ALTER TABLE broker_profiles ADD COLUMN user_type text DEFAULT 'broker';
  END IF;
END $$;

-- Add check constraint for valid roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'broker_profiles' AND constraint_name = 'broker_profiles_role_check'
  ) THEN
    ALTER TABLE broker_profiles ADD CONSTRAINT broker_profiles_role_check 
      CHECK (role IN ('super_admin', 'admin', 'agent', 'staff'));
  END IF;
END $$;

-- Add check constraint for valid user_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'broker_profiles' AND constraint_name = 'broker_profiles_user_type_check'
  ) THEN
    ALTER TABLE broker_profiles ADD CONSTRAINT broker_profiles_user_type_check 
      CHECK (user_type IN ('broker'));
  END IF;
END $$;

-- Similarly add to client_profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE client_profiles ADD COLUMN role text DEFAULT 'client';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_profiles' AND column_name = 'user_type'
  ) THEN
    ALTER TABLE client_profiles ADD COLUMN user_type text DEFAULT 'client';
  END IF;
END $$;

-- Add check constraint for client roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'client_profiles' AND constraint_name = 'client_profiles_role_check'
  ) THEN
    ALTER TABLE client_profiles ADD CONSTRAINT client_profiles_role_check 
      CHECK (role IN ('client'));
  END IF;
END $$;

-- Add check constraint for client user_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'client_profiles' AND constraint_name = 'client_profiles_user_type_check'
  ) THEN
    ALTER TABLE client_profiles ADD CONSTRAINT client_profiles_user_type_check 
      CHECK (user_type IN ('client'));
  END IF;
END $$;
