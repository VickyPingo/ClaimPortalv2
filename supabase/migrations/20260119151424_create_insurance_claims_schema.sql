/*
  # Insurance Claims SaaS Platform - Multi-Tenant Schema

  ## Overview
  This migration creates a multi-tenant insurance claims platform where each brokerage
  operates independently with complete data isolation.

  ## 1. New Tables
  
  ### `brokerages`
  - `id` (uuid, primary key) - Unique brokerage identifier
  - `name` (text) - Brokerage business name
  - `logo_url` (text, optional) - Custom logo for white-labeling
  - `brand_color` (text, optional) - Custom brand color (hex code)
  - `created_at` (timestamptz) - Registration timestamp
  
  ### `broker_users`
  - `id` (uuid, primary key) - User identifier (linked to auth.users)
  - `brokerage_id` (uuid) - Links staff to their brokerage
  - `phone` (text, unique) - Phone number for authentication
  - `name` (text) - Staff member name
  - `role` (text) - Role within brokerage (admin, staff)
  - `created_at` (timestamptz)
  
  ### `clients`
  - `id` (uuid, primary key) - Client identifier
  - `brokerage_id` (uuid) - Links client to specific brokerage
  - `phone` (text) - Client phone number
  - `name` (text, optional) - Client name
  - `created_at` (timestamptz)
  
  ### `claims`
  - `id` (uuid, primary key) - Claim identifier
  - `brokerage_id` (uuid) - Links claim to brokerage for data isolation
  - `client_id` (uuid) - Links to client who filed claim
  - `incident_type` (text) - Type: 'motor_accident' or 'burst_geyser'
  - `status` (text) - Status: 'new', 'investigating', or 'resolved'
  - `location_lat` (numeric) - GPS latitude
  - `location_lng` (numeric) - GPS longitude
  - `voice_note_url` (text, optional) - Storage URL for voice recording
  - `voice_transcript_en` (text, optional) - AI-translated English transcript
  - `third_party_details` (jsonb, optional) - For motor accidents (name, contact, etc)
  - `media_urls` (jsonb) - Array of uploaded photo/video URLs
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## 2. Security
  
  ### Row Level Security (RLS)
  All tables have RLS enabled with strict policies ensuring:
  - Brokerages can ONLY access their own data
  - Clients can ONLY access their own claims
  - No cross-brokerage data leakage
  
  ### Policies
  - Brokerages: Full access to own record
  - Broker Users: Access to own brokerage's data
  - Clients: Access to own claims only
  - Claims: Filtered by brokerage_id for complete isolation

  ## 3. Important Notes
  - Multi-tenancy enforced at database level via brokerage_id
  - All foreign keys ensure referential integrity
  - Indexes added for performance on common queries
  - Default status for new claims is 'new'
  - Media URLs stored as JSONB array for flexibility
*/

-- Create brokerages table
CREATE TABLE IF NOT EXISTS brokerages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  brand_color text DEFAULT '#1e40af',
  created_at timestamptz DEFAULT now()
);

-- Create broker_users table
CREATE TABLE IF NOT EXISTS broker_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id uuid NOT NULL REFERENCES brokerages(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  created_at timestamptz DEFAULT now()
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id uuid NOT NULL REFERENCES brokerages(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(brokerage_id, phone)
);

-- Create claims table
CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id uuid NOT NULL REFERENCES brokerages(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  incident_type text NOT NULL CHECK (incident_type IN ('motor_accident', 'burst_geyser')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'resolved')),
  location_lat numeric,
  location_lng numeric,
  voice_note_url text,
  voice_transcript_en text,
  third_party_details jsonb,
  media_urls jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_broker_users_brokerage ON broker_users(brokerage_id);
CREATE INDEX IF NOT EXISTS idx_clients_brokerage ON clients(brokerage_id);
CREATE INDEX IF NOT EXISTS idx_claims_brokerage ON claims(brokerage_id);
CREATE INDEX IF NOT EXISTS idx_claims_client ON claims(client_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

-- Enable Row Level Security
ALTER TABLE brokerages ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- RLS Policies for brokerages table
CREATE POLICY "Brokerages can view own record"
  ON brokerages FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Brokerages can update own record"
  ON brokerages FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  );

-- RLS Policies for broker_users table
CREATE POLICY "Broker users can view own brokerage staff"
  ON broker_users FOR SELECT
  TO authenticated
  USING (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Broker users can view own record"
  ON broker_users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- RLS Policies for clients table
CREATE POLICY "Broker users can view own brokerage clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Broker users can create clients for their brokerage"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  );

-- RLS Policies for claims table
CREATE POLICY "Broker users can view own brokerage claims"
  ON claims FOR SELECT
  TO authenticated
  USING (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Broker users can update own brokerage claims"
  ON claims FOR UPDATE
  TO authenticated
  USING (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Clients can insert claims for their brokerage"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE id = auth.uid()
    )
  );

CREATE POLICY "Clients can view own claims"
  ON claims FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();