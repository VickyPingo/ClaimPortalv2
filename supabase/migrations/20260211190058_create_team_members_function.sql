/*
  # Create Team Members Function

  1. Purpose
    - Create a database function to fetch team members with their email addresses
    - This function runs server-side and can safely access auth.users table

  2. Changes
    - Create RPC function get_team_members_with_email
    - Returns team member profiles enriched with email from auth.users

  3. Security
    - Function is accessible by authenticated users
    - Returns only profiles within the specified brokerage
*/

-- Function: Get team members with email addresses
CREATE OR REPLACE FUNCTION get_team_members_with_email(target_brokerage_id UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  role TEXT,
  user_type TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.id,
    bp.full_name,
    COALESCE(au.email, 'Unknown') as email,
    bp.role,
    bp.user_type,
    bp.phone_number,
    bp.created_at
  FROM broker_profiles bp
  LEFT JOIN auth.users au ON au.id = bp.id
  WHERE bp.brokerage_id = target_brokerage_id
  ORDER BY bp.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_team_members_with_email(UUID) TO authenticated;
