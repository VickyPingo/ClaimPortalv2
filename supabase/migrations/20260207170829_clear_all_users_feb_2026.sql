/*
  # Clear All Users - February 2026
  
  1. Changes
    - Delete all claim-related data (claims, notes, items)
    - Delete all user profiles (client_profiles, broker_profiles, profiles)
    - Delete all users from auth.users table
    - Preserves the database schema, organizations, brokerages, and system configuration
    
  2. Security
    - This is a destructive operation that removes ALL user accounts and their data
    - Use only in development/testing environments
    - Organization structure and brokerage configuration remain intact
    
  3. Order of Operations
    - Claim notes deleted first (depends on claims)
    - Theft items deleted second (depends on theft_claims)
    - All claim types deleted third
    - User profiles deleted fourth
    - Auth users deleted last
*/

-- Delete all claim notes first (references claims and broker_users)
DELETE FROM claim_notes WHERE TRUE;

-- Delete all theft items (references theft_claims)
DELETE FROM theft_items WHERE TRUE;

-- Delete all claims of different types
DELETE FROM all_risk_claims WHERE TRUE;
DELETE FROM structural_damage_claims WHERE TRUE;
DELETE FROM motor_vehicle_theft_claims WHERE TRUE;
DELETE FROM theft_claims WHERE TRUE;
DELETE FROM claims WHERE TRUE;

-- Delete all user profiles
DELETE FROM client_profiles WHERE TRUE;
DELETE FROM broker_profiles WHERE TRUE;
DELETE FROM profiles WHERE TRUE;

-- Delete all users from auth (organizations and brokerages remain intact)
DELETE FROM auth.users WHERE TRUE;
