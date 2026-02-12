/*
  # Auto-Create Super Admin Profile for vickypingo@gmail.com

  1. Changes
    - Updates handle_new_user() function to automatically create super_admin profile
    - Detects vickypingo@gmail.com email and creates broker_profile with role='super_admin'
    - Ensures super admin always has a profile, even without metadata
    - Bypasses brokerage_id requirement for super admins (set to NULL)

  2. Security
    - Only applies to vickypingo@gmail.com email
    - Automatically grants full super_admin access
    - Profile created with user_type='super_admin' and role='super_admin'
*/

-- Update the handle_new_user function to include super admin detection
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  user_type text;
  brokerage_id_val uuid;
  full_name_val text;
  id_number_val text;
  cell_number_val text;
  policy_number_val text;
BEGIN
  -- CRITICAL: Auto-create super admin profile for vickypingo@gmail.com
  IF NEW.email = 'vickypingo@gmail.com' THEN
    RAISE NOTICE 'Super admin detected: %, creating super_admin profile', NEW.email;

    -- Create broker_profiles entry with super_admin role
    INSERT INTO broker_profiles (
      id,
      brokerage_id,
      full_name,
      id_number,
      cell_number,
      policy_number,
      role,
      user_type
    )
    VALUES (
      NEW.id,
      NULL, -- Super admins don't belong to a specific brokerage
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Super Admin'),
      '',
      '',
      NULL,
      'super_admin',
      'super_admin'
    )
    ON CONFLICT (id) DO UPDATE
    SET
      role = 'super_admin',
      user_type = 'super_admin',
      full_name = COALESCE(EXCLUDED.full_name, 'Super Admin');

    RAISE NOTICE 'Auto-created super_admin profile for %', NEW.email;
    RETURN NEW;
  END IF;

  -- Extract metadata from the new user
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', '');
  user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', '');

  -- Only proceed if user is signing up as a broker
  IF user_role = 'broker' AND user_type = 'broker' THEN
    -- Extract brokerage_id from metadata, fallback to default
    brokerage_id_val := COALESCE(
      (NEW.raw_user_meta_data->>'brokerage_id')::uuid,
      'f67b67c8-086b-4b42-8d27-917a0783e9b0'::uuid
    );

    -- Extract profile data from metadata
    full_name_val := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User');
    id_number_val := COALESCE(NEW.raw_user_meta_data->>'id_number', '');
    cell_number_val := COALESCE(NEW.raw_user_meta_data->>'cell_number', '');
    policy_number_val := NEW.raw_user_meta_data->>'policy_number';

    -- Create broker_users entry
    INSERT INTO broker_users (id, brokerage_id)
    VALUES (NEW.id, brokerage_id_val)
    ON CONFLICT (id) DO UPDATE
    SET brokerage_id = EXCLUDED.brokerage_id;

    -- Create broker_profiles entry
    INSERT INTO broker_profiles (
      id,
      brokerage_id,
      full_name,
      id_number,
      cell_number,
      policy_number,
      role,
      user_type
    )
    VALUES (
      NEW.id,
      brokerage_id_val,
      full_name_val,
      id_number_val,
      cell_number_val,
      policy_number_val,
      user_role,
      user_type
    )
    ON CONFLICT (id) DO UPDATE
    SET
      full_name = EXCLUDED.full_name,
      id_number = EXCLUDED.id_number,
      cell_number = EXCLUDED.cell_number,
      policy_number = EXCLUDED.policy_number,
      role = EXCLUDED.role,
      user_type = EXCLUDED.user_type,
      brokerage_id = EXCLUDED.brokerage_id;

    RAISE NOTICE 'Auto-created broker profile for user %', NEW.id;
  END IF;

  -- Only proceed if user is signing up as a client
  IF user_role = 'client' AND user_type = 'client' THEN
    -- Extract brokerage_id from metadata, fallback to default
    brokerage_id_val := COALESCE(
      (NEW.raw_user_meta_data->>'brokerage_id')::uuid,
      'f67b67c8-086b-4b42-8d27-917a0783e9b0'::uuid
    );

    -- Extract profile data from metadata
    full_name_val := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User');
    cell_number_val := COALESCE(NEW.raw_user_meta_data->>'cell_number', '');

    -- Create client_profiles entry
    INSERT INTO client_profiles (
      id,
      brokerage_id,
      full_name,
      email,
      cell_number,
      role,
      user_type
    )
    VALUES (
      NEW.id,
      brokerage_id_val,
      full_name_val,
      COALESCE(NEW.email, ''),
      cell_number_val,
      user_role,
      user_type
    )
    ON CONFLICT (id) DO UPDATE
    SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      cell_number = EXCLUDED.cell_number,
      role = EXCLUDED.role,
      user_type = EXCLUDED.user_type,
      brokerage_id = EXCLUDED.brokerage_id;

    RAISE NOTICE 'Auto-created client profile for user %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
