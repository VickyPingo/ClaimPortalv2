/*
  # Auto-create Client Records on Profile Creation

  ## Overview
  This migration creates a trigger that automatically creates a `clients` table record
  whenever a new `client_profiles` record is created. This ensures backward compatibility
  with claim submission code that expects records in the legacy `clients` table.

  ## Changes Made
  1. **Trigger Function**: `handle_new_client_profile()`
     - Automatically creates a matching record in `clients` table
     - Uses the client_profile's id, brokerage_id, cell_number as phone, and full_name as name
     - Only creates the client record if it doesn't already exist
  
  2. **Trigger**: `on_client_profile_created`
     - Fires after INSERT on `client_profiles` table
     - Calls the `handle_new_client_profile()` function
  
  3. **Backfill**: Existing client_profiles without corresponding clients
     - Ensures all existing users have client records

  ## Security
  - Function uses SECURITY DEFINER to bypass RLS during automatic creation
  - Only creates records, doesn't modify or delete existing data
*/

-- Create function to handle new client profile creation
CREATE OR REPLACE FUNCTION handle_new_client_profile()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
  -- Insert into clients table if not exists
  INSERT INTO clients (id, brokerage_id, phone, name, created_at)
  VALUES (
    NEW.id,
    NEW.brokerage_id,
    NEW.cell_number,
    NEW.full_name,
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new client profiles
DROP TRIGGER IF EXISTS on_client_profile_created ON client_profiles;
CREATE TRIGGER on_client_profile_created
  AFTER INSERT ON client_profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_client_profile();

-- Backfill existing client_profiles that don't have clients records
INSERT INTO clients (id, brokerage_id, phone, name, created_at)
SELECT 
  cp.id,
  cp.brokerage_id,
  cp.cell_number,
  cp.full_name,
  cp.created_at
FROM client_profiles cp
LEFT JOIN clients c ON c.id = cp.id
WHERE c.id IS NULL
ON CONFLICT (id) DO NOTHING;