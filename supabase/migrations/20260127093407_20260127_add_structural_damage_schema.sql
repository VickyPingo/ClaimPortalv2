/*
  # Create structural damage claims table

  1. New Tables
    - `structural_damage_claims`
      - `id` (uuid, primary key)
      - `brokerage_id` (uuid, foreign key to brokerages)
      - `client_id` (uuid, nullable, foreign key to clients)
      - `incident_type` (text: 'storm_water', 'fire_explosion', 'impact', 'accidental_fixtures', 'theft_fixtures', 'lightning_power_surge')
      - `sub_incident_type` (text, nullable: for lightning - 'fixed_items' or 'movable_items')
      - `is_habitable` (boolean)
      - `is_property_secure` (boolean)
      - `water_entry_point` (text, nullable: 'roof', 'window', 'rising_damp', 'flash_flood')
      - `is_gradual_leak` (boolean, nullable)
      - `roof_construction` (text, nullable: for fire/storm - 'tile', 'metal', 'slate', 'thatch')
      - `is_glass_only` (boolean, nullable)
      - `is_bonded` (boolean, nullable)
      - `bond_holder_bank` (text, nullable)
      - `estimated_repair_cost` (numeric, nullable)
      - `damage_photos_urls` (text array)
      - `repair_quote_1_url` (text, nullable)
      - `repair_quote_2_url` (text, nullable)
      - `contractor_report_url` (text, nullable)
      - `location_address` (text)
      - `location_lat` (numeric)
      - `location_lng` (numeric)
      - `voice_note_url` (text, nullable)
      - `voice_transcript_en` (text, nullable)
      - `status` (text default 'submitted')
      - `created_at` (timestamptz default now())
      - `updated_at` (timestamptz default now())

  2. Security
    - Enable RLS on `structural_damage_claims` table
    - Add policies for authenticated clients and anonymous submissions
*/

CREATE TABLE IF NOT EXISTS structural_damage_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id uuid NOT NULL REFERENCES brokerages(id),
  client_id uuid REFERENCES clients(id),
  incident_type text NOT NULL CHECK (incident_type IN ('storm_water', 'fire_explosion', 'impact', 'accidental_fixtures', 'theft_fixtures', 'lightning_power_surge')),
  sub_incident_type text,
  is_habitable boolean,
  is_property_secure boolean,
  water_entry_point text,
  is_gradual_leak boolean,
  roof_construction text,
  is_glass_only boolean,
  is_bonded boolean,
  bond_holder_bank text,
  estimated_repair_cost numeric,
  damage_photos_urls text[] DEFAULT '{}',
  repair_quote_1_url text,
  repair_quote_2_url text,
  contractor_report_url text,
  location_address text NOT NULL,
  location_lat numeric,
  location_lng numeric,
  voice_note_url text,
  voice_transcript_en text,
  status text DEFAULT 'submitted',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE structural_damage_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated clients can read own structural claims"
  ON structural_damage_claims FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Brokers can read structural claims for their brokerage"
  ON structural_damage_claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM broker_users
      WHERE broker_users.id = auth.uid()
      AND broker_users.brokerage_id = structural_damage_claims.brokerage_id
    )
  );

CREATE POLICY "Anonymous users can insert structural damage claims"
  ON structural_damage_claims FOR INSERT
  TO anon
  WITH CHECK (client_id IS NULL);

CREATE POLICY "Authenticated clients can insert structural damage claims"
  ON structural_damage_claims FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());
