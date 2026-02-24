/*
  # Prevent Signup from Overriding Invitation Roles

  1. Changes
    - Updates handle_new_user() trigger to check for active invitations first
    - If user has an active invitation, DON'T create a profile from metadata
    - This prevents client signup from overwriting broker invitation roles
    - Edge functions will handle profile creation for invited users

  2. Important Notes
    - Invited users should ONLY complete signup via invitation link
    - Direct signup (client or broker) should fail if invitation exists
    - This ensures role and brokerage_id come from invitation, not signup metadata
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  user_type text;
  brokerage_id_val uuid;
  organization_id_val uuid;
  full_name_val text;
  id_number_val text;
  cell_number_val text;
  policy_number_val text;
  has_invitation boolean;
BEGIN
  -- CRITICAL: Check if user has an active invitation
  -- If they do, DON'T create profile here - let the edge function handle it
  SELECT EXISTS (
    SELECT 1 FROM invitations
    WHERE email = NEW.email
    AND is_active = true
  ) INTO has_invitation;

  IF has_invitation THEN
    RAISE NOTICE 'User % has active invitation - skipping auto profile creation', NEW.email;
    RAISE NOTICE 'Profile will be created by invitation edge function with correct role';
    RETURN NEW;
  END IF;

  -- CRITICAL: Auto-create super admin profile for vickypingo@gmail.com
  IF NEW.email = 'vickypingo@gmail.com' THEN
    RAISE NOTICE 'Super admin detected: %, creating profile in profiles table', NEW.email;

    -- Get first organization
    SELECT id INTO organization_id_val FROM organizations LIMIT 1;

    -- Create profiles entry with super_admin role
    INSERT INTO profiles (
      id,
      user_id,
      organization_id,
      full_name,
      email,
      role,
      cell_number,
      id_number
    )
    VALUES (
      NEW.id,
      NEW.id,
      organization_id_val,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Vicky Pingo'),
      NEW.email,
      'super_admin',
      '',
      ''
    )
    ON CONFLICT (id) DO UPDATE
    SET
      role = 'super_admin',
      email = NEW.email;

    RAISE NOTICE 'Auto-created profile for super admin %', NEW.email;
    RETURN NEW;
  END IF;

  -- Extract metadata from the new user
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', '');
  user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', '');

  -- Only proceed if user is signing up as a broker (and has no invitation)
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

  -- Only proceed if user is signing up as a client (and has no invitation)
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