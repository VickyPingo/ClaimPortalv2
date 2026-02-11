/*
  # Auto-Create Broker Profiles on User Signup

  1. Purpose
    - Automatically create broker_users and broker_profiles entries when a user signs up
    - Uses metadata from auth.users.raw_user_meta_data to populate profiles
    - Ensures seamless registration flow without manual profile creation

  2. New Functions
    - `handle_new_user()` - Trigger function that:
      - Checks if user signed up with role='broker' in metadata
      - Creates broker_users entry with brokerage_id from metadata
      - Creates broker_profiles entry with all user details from metadata
      - Gracefully handles missing data with defaults

  3. Triggers
    - `on_auth_user_created` - Fires after INSERT on auth.users
    - Automatically populates broker_users and broker_profiles tables

  4. Security
    - Function runs with SECURITY DEFINER to bypass RLS during profile creation
    - Only creates profiles for users with role='broker' metadata
    - Falls back to default brokerage if none specified
*/

-- Function to handle new user creation
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
  -- Extract metadata from the new user
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', '');
  user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', '');
  
  -- Only proceed if user is signing up as a broker
  IF user_role = 'broker' AND user_type = 'broker' THEN
    -- Extract brokerage_id from metadata, fallback to default
    brokerage_id_val := COALESCE(
      (NEW.raw_user_meta_data->>'brokerage_id')::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid
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
      '00000000-0000-0000-0000-000000000000'::uuid
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to fire after user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
