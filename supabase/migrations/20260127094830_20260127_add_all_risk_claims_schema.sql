/*
  # Create all-risk portable possessions claims table

  1. New Tables
    - `all_risk_claims`
      - `id` (uuid, primary key)
      - `brokerage_id` (uuid, foreign key to brokerages)
      - `client_id` (uuid, nullable, foreign key to clients)
      - `incident_type` (text: 'stolen', 'accidentally_damaged', 'lost_missing')
      - `incident_date_time` (timestamptz)
      - `incident_location` (text, e.g., "Cape Town International Airport")
      - `is_international` (boolean)
      - `departure_date` (date, nullable, for international incidents)
      - `saps_case_number` (text, nullable, required for theft)
      - `damage_description` (text, nullable, for accidental damage)
      - `last_known_location` (text, nullable, for lost/missing)
      - `items` (jsonb array of {id, description, make_model, serial_imei, replacement_value, on_policy, category})
      - `is_repairable` (boolean, nullable)
      - `damage_report_url` (text, nullable)
      - `repair_quote_url` (text, nullable)
      - `replacement_quote_url` (text, nullable)
      - `proof_of_ownership_urls` (text array)
      - `police_report_url` (text, nullable)
      - `valuation_certificate_url` (text, nullable)
      - `voice_note_url` (text, nullable)
      - `voice_transcript_en` (text, nullable)
      - `status` (text default 'submitted')
      - `created_at` (timestamptz default now())
      - `updated_at` (timestamptz default now())

  2. Security
    - Enable RLS on `all_risk_claims` table
    - Add policies for authenticated clients and anonymous submissions
*/

CREATE TABLE IF NOT EXISTS all_risk_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id uuid NOT NULL REFERENCES brokerages(id),
  client_id uuid REFERENCES clients(id),
  incident_type text NOT NULL CHECK (incident_type IN ('stolen', 'accidentally_damaged', 'lost_missing')),
  incident_date_time timestamptz NOT NULL,
  incident_location text NOT NULL,
  is_international boolean DEFAULT false,
  departure_date date,
  saps_case_number text,
  damage_description text,
  last_known_location text,
  items jsonb DEFAULT '[]'::jsonb,
  is_repairable boolean,
  damage_report_url text,
  repair_quote_url text,
  replacement_quote_url text,
  proof_of_ownership_urls text[] DEFAULT '{}',
  police_report_url text,
  valuation_certificate_url text,
  voice_note_url text,
  voice_transcript_en text,
  status text DEFAULT 'submitted',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE all_risk_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated clients can read own all-risk claims"
  ON all_risk_claims FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Brokers can read all-risk claims for their brokerage"
  ON all_risk_claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM broker_users
      WHERE broker_users.id = auth.uid()
      AND broker_users.brokerage_id = all_risk_claims.brokerage_id
    )
  );

CREATE POLICY "Anonymous users can insert all-risk claims"
  ON all_risk_claims FOR INSERT
  TO anon
  WITH CHECK (client_id IS NULL);

CREATE POLICY "Authenticated clients can insert all-risk claims"
  ON all_risk_claims FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());
