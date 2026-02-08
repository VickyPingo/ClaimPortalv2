/*
  # Create broker profiles table for broker user details

  1. New Tables
    - `broker_profiles`
      - `id` (uuid, primary key) - Links to auth.users.id
      - `full_name` (text) - Full name of broker
      - `id_number` (text) - ID/Passport number
      - `cell_number` (text) - Contact cell number
      - `policy_number` (text, optional) - Optional policy number
      - `brokerage_id` (uuid) - Links to brokerages table
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on broker_profiles
    - Users can only read/update their own profile
    - Brokers can view all profiles in their brokerage (for admin)

  3. Purpose
    - Store broker user details linked to Supabase auth
    - Enable auto-population of claim forms
    - Support user profile management
*/

CREATE TABLE IF NOT EXISTS broker_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brokerage_id uuid NOT NULL REFERENCES brokerages(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  id_number text NOT NULL,
  cell_number text NOT NULL,
  policy_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_profiles_brokerage ON broker_profiles(brokerage_id);

ALTER TABLE broker_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON broker_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON broker_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Brokers can view own brokerage profiles"
  ON broker_profiles FOR SELECT
  TO authenticated
  USING (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Brokers can insert profiles in their brokerage"
  ON broker_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_broker_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_broker_profiles_updated_at
      BEFORE UPDATE ON broker_profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
