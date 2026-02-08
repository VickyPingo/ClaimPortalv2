/*
  # Add Theft Claim Support

  1. New Tables
    - `theft_claims` - Main theft claim table
    - `theft_items` - Individual stolen items registry
  
  2. Fields for theft_claims:
    - Police case number (CAS format)
    - Police station name
    - Date reported to police
    - Investigating officer name
    - Incident date & time
    - Property occupancy flag
    - Forced entry flag
    - Forced entry photo URL
    - Incident location (address, lat, lng)
    - Has cellphone stolen flag
    - ITC reference number
    - Supporting documents (SAPS case slip, proof of ownership, replacement quote)
    - Total claim value (computed)
  
  3. Fields for theft_items:
    - Item description
    - Make/model
    - Serial number
    - Purchase year
    - Replacement value
    - Proof type (invoice, bank statement, photo, manual)
  
  4. Security
    - RLS enabled on both tables
    - Clients can only access their own theft claims
    - Brokers can access their brokerage's theft claims
*/

CREATE TABLE IF NOT EXISTS theft_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id uuid NOT NULL REFERENCES brokerages(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'resolved')),
  saps_case_number text NOT NULL,
  police_station_name text NOT NULL,
  date_reported timestamptz NOT NULL,
  investigating_officer_name text,
  incident_date_time timestamptz NOT NULL,
  property_occupied boolean NOT NULL,
  forced_entry boolean NOT NULL,
  forced_entry_photo_url text,
  incident_location_address text,
  incident_lat numeric,
  incident_lng numeric,
  cellphone_stolen boolean DEFAULT false,
  itc_reference_number text,
  saps_case_slip_url text,
  proof_of_ownership_urls jsonb DEFAULT '[]'::jsonb,
  replacement_quote_url text,
  total_claim_value numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS theft_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theft_claim_id uuid NOT NULL REFERENCES theft_claims(id) ON DELETE CASCADE,
  item_description text NOT NULL,
  make_model text,
  serial_number text,
  purchase_year integer,
  replacement_value numeric NOT NULL,
  proof_type text NOT NULL CHECK (proof_type IN ('invoice', 'bank_statement', 'photo', 'manual')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_theft_claims_brokerage ON theft_claims(brokerage_id);
CREATE INDEX IF NOT EXISTS idx_theft_claims_client ON theft_claims(client_id);
CREATE INDEX IF NOT EXISTS idx_theft_claims_status ON theft_claims(status);
CREATE INDEX IF NOT EXISTS idx_theft_items_claim ON theft_items(theft_claim_id);

ALTER TABLE theft_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE theft_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Broker users can view own brokerage theft claims"
  ON theft_claims FOR SELECT
  TO authenticated
  USING (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Broker users can update own brokerage theft claims"
  ON theft_claims FOR UPDATE
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

CREATE POLICY "Clients can insert theft claims for their brokerage"
  ON theft_claims FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE id = auth.uid()
    )
  );

CREATE POLICY "Clients can view own theft claims"
  ON theft_claims FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE id = auth.uid()
    )
  );

CREATE POLICY "Broker users can view theft items in own brokerage"
  ON theft_items FOR SELECT
  TO authenticated
  USING (
    theft_claim_id IN (
      SELECT id FROM theft_claims WHERE brokerage_id IN (
        SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Clients can insert theft items for their claims"
  ON theft_items FOR INSERT
  TO authenticated
  WITH CHECK (
    theft_claim_id IN (
      SELECT id FROM theft_claims WHERE client_id = auth.uid()
    )
  );

CREATE TRIGGER update_theft_claims_updated_at
  BEFORE UPDATE ON theft_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
