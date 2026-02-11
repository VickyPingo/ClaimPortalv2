/*
  # Create Super Admin User for vickypingo@gmail.com

  1. Purpose
    - Create or update vickypingo@gmail.com to be a super admin
    - Ensure proper broker_users and broker_profiles entries exist
    - Set role to 'super_admin' and user_type to 'broker'

  2. Changes
    - Create/update entry in broker_users for vickypingo@gmail.com
    - Create/update entry in broker_profiles with super_admin role
    - Linked to Independi brokerage (f67b67c8-086b-4b42-8d27-917a0783e9b0)

  3. Security
    - Only affects vickypingo@gmail.com
    - Sets super_admin role for full platform access
*/

-- Create a function to ensure super admin setup
CREATE OR REPLACE FUNCTION ensure_super_admin_setup()
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_brokerage_id uuid := 'f67b67c8-086b-4b42-8d27-917a0783e9b0';
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'vickypingo@gmail.com';

  -- Only proceed if user exists
  IF v_user_id IS NOT NULL THEN
    -- Ensure broker_users entry exists
    INSERT INTO broker_users (id, brokerage_id, name, phone, role)
    VALUES (
      v_user_id,
      v_brokerage_id,
      'Vicky Pingo',
      '+27 00 000 0000',
      'super_admin'
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'super_admin',
        brokerage_id = v_brokerage_id;

    -- Ensure broker_profiles entry exists
    INSERT INTO broker_profiles (id, brokerage_id, full_name, id_number, cell_number, role, user_type)
    VALUES (
      v_user_id,
      v_brokerage_id,
      'Vicky Pingo',
      '0000000000000',
      '+27 00 000 0000',
      'super_admin',
      'broker'
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'super_admin',
        user_type = 'broker',
        brokerage_id = v_brokerage_id;

    RAISE NOTICE 'Super admin setup complete for vickypingo@gmail.com';
  ELSE
    RAISE NOTICE 'User vickypingo@gmail.com does not exist yet - will be set up on first login';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT ensure_super_admin_setup();

-- Drop the function as it's no longer needed
DROP FUNCTION ensure_super_admin_setup();
