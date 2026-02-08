/*
  # Clear All Registered Users
  
  1. Changes
    - Delete all user profiles from the profiles table
    - Delete all users from the auth.users table
    - Preserves the database schema and organization data
    
  2. Security
    - This is a destructive operation that removes ALL user accounts
    - Use only in development/testing environments
*/

-- Delete all profiles first (to avoid foreign key issues)
DELETE FROM profiles;

-- Delete all users from auth
DELETE FROM auth.users;
