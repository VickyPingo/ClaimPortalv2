/*
  # Fix Client Signup Profile Creation

  1. Changes
    - Updates handle_new_user() trigger to create profiles in BOTH tables
    - Creates entry in profiles table with organization_id for all clients
    - Creates entry in client_profiles table for backward compatibility
    - Ensures email, full_name, and organization_id are properly set
    - Fetches brokerage_id from subdomain via brokerage_slug metadata

  2. Important Notes
    - Clients will now have complete profiles in the profiles table
    - Routing will work correctly based on role='client' in profiles table
    - Maintains backward compatibility with client_profiles table
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
  brokerage_slug_val text;
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
      id_number,
      is_active
    )
    VALUES (
      NEW.id,
      NEW.id,
      organization_id_val,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Vicky Pingo'),
      NEW.email,
      'super_admin',
      '',
      '',
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET
      role = 'super_admin',
      email = NEW.email,
      is_active = true;

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

  -- CRITICAL: Client signup - create profile in BOTH profiles AND client_profiles tables
  IF user_role = 'client' AND user_type = 'client' THEN
    -- Get brokerage_slug from metadata
    brokerage_slug_val := NEW.raw_user_meta_data->>'brokerage_slug';

    -- Look up organization_id from brokerages table using slug
    IF brokerage_slug_val IS NOT NULL THEN
      SELECT id INTO organization_id_val
      FROM brokerages
      WHERE slug = brokerage_slug_val OR subdomain = brokerage_slug_val
      LIMIT 1;
    END IF;

    -- Fallback to metadata brokerage_id or default
    IF organization_id_val IS NULL THEN
      organization_id_val := COALESCE(
        (NEW.raw_user_meta_data->>'brokerage_id')::uuid,
        'f67b67c8-086b-4b42-8d27-917a0783e9b0'::uuid
      );
    END IF;

    -- Extract profile data from metadata
    full_name_val := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User');
    cell_number_val := COALESCE(NEW.raw_user_meta_data->>'cell_number', '');

    -- Create entry in profiles table (NEW - for unified auth routing)
    INSERT INTO profiles (
      id,
      user_id,
      organization_id,
      full_name,
      email,
      cell_number,
      role,
      is_active
    )
    VALUES (
      NEW.id,
      NEW.id,
      organization_id_val,
      full_name_val,
      COALESCE(NEW.email, ''),
      cell_number_val,
      'client',
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      cell_number = EXCLUDED.cell_number,
      role = EXCLUDED.role,
      organization_id = EXCLUDED.organization_id,
      is_active = EXCLUDED.is_active;

    -- Create client_profiles entry (for backward compatibility)
    INSERT INTO client_profiles (
      id,
      user_id,
      brokerage_id,
      full_name,
      email,
      cell_number,
      role,
      user_type,
      is_active
    )
    VALUES (
      NEW.id,
      NEW.id,
      organization_id_val,
      full_name_val,
      COALESCE(NEW.email, ''),
      cell_number_val,
      'client',
      'client',
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      cell_number = EXCLUDED.cell_number,
      role = EXCLUDED.role,
      user_type = EXCLUDED.user_type,
      brokerage_id = EXCLUDED.brokerage_id,
      is_active = EXCLUDED.is_active;

    RAISE NOTICE 'Auto-created client profile in profiles AND client_profiles for user %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;