/*
  # Create client profiles table for client user details

  1. New Tables
    - `client_profiles`
      - `id` (uuid, primary key) - Links to auth.users.id
      - `full_name` (text) - Full name of client
      - `email` (text) - Email address
      - `cell_number` (text) - Contact cell number
      - `brokerage_id` (uuid) - Links to brokerages table (the brokerage this client is with)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on client_profiles
    - Users can only read/update their own profile
    - Clients linked to specific brokerages

  3. Purpose
    - Store client user details linked to Supabase auth
    - Enable auto-population of claim forms for clients
    - Support client profile management
*/

CREATE TABLE IF NOT EXISTS client_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brokerage_id uuid NOT NULL REFERENCES brokerages(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  cell_number text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_profiles_brokerage ON client_profiles(brokerage_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_email ON client_profiles(email);

ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own profile"
  ON client_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Clients can update own profile"
  ON client_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Brokers can view clients in their brokerage"
  ON client_profiles FOR SELECT
  TO authenticated
  USING (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Brokers can insert client profiles"
  ON client_profiles FOR INSERT
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
    WHERE trigger_name = 'update_client_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_client_profiles_updated_at
      BEFORE UPDATE ON client_profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
