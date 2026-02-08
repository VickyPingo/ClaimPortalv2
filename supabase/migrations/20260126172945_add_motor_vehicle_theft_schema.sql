/*
  # Motor Vehicle Theft Claim Schema

  1. New Tables
    - `motor_vehicle_theft_claims`
      - `id` (uuid, primary key)
      - `brokerage_id` (uuid, foreign key to brokerages)
      - `client_id` (uuid, foreign key to clients)
      - `incident_type` (text) - 'theft' or 'hijacking'
      - `trauma_counseling_requested` (boolean) - for hijacking cases
      - `has_all_keys` (boolean) - for theft cases
      - `missing_keys_explanation` (text) - if not all keys
      - `vehicle_make` (text)
      - `vehicle_model` (text)
      - `vehicle_year` (integer)
      - `vehicle_registration` (text)
      - `vehicle_vin` (text)
      - `vehicle_color` (text)
      - `is_financed` (boolean)
      - `finance_bank` (text)
      - `finance_account_number` (text)
      - `has_tracking_device` (boolean)
      - `reported_to_tracker` (boolean)
      - `tracker_company_name` (text)
      - `last_driver_name` (text)
      - `last_driver_id_number` (text)
      - `last_driver_license_code` (text)
      - `driver_license_front_url` (text)
      - `driver_license_back_url` (text)
      - `saps_case_slip_url` (text)
      - `proof_of_purchase_url` (text)
      - `finance_settlement_letter_url` (text)
      - `last_known_location_lat` (double precision)
      - `last_known_location_lng` (double precision)
      - `last_known_location_address` (text)
      - `saps_case_number` (text)
      - `police_station_name` (text)
      - `date_reported` (timestamptz)
      - `incident_date_time` (timestamptz)
      - `status` (text) - default 'pending'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `motor_vehicle_theft_claims` table
    - Add policy for authenticated users to insert their own claims
    - Add policy for authenticated users to view their own claims
    - Add policy for brokers to view claims in their brokerage
    - Add policy for brokers to update claims in their brokerage
*/

CREATE TABLE IF NOT EXISTS motor_vehicle_theft_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id uuid NOT NULL REFERENCES brokerages(id),
  client_id uuid NOT NULL,
  incident_type text NOT NULL CHECK (incident_type IN ('theft', 'hijacking')),
  trauma_counseling_requested boolean DEFAULT false,
  has_all_keys boolean,
  missing_keys_explanation text,
  vehicle_make text NOT NULL,
  vehicle_model text NOT NULL,
  vehicle_year integer NOT NULL,
  vehicle_registration text NOT NULL,
  vehicle_vin text,
  vehicle_color text NOT NULL,
  is_financed boolean DEFAULT false,
  finance_bank text,
  finance_account_number text,
  has_tracking_device boolean DEFAULT false,
  reported_to_tracker boolean,
  tracker_company_name text,
  last_driver_name text NOT NULL,
  last_driver_id_number text NOT NULL,
  last_driver_license_code text NOT NULL,
  driver_license_front_url text,
  driver_license_back_url text,
  saps_case_slip_url text NOT NULL,
  proof_of_purchase_url text,
  finance_settlement_letter_url text,
  last_known_location_lat double precision,
  last_known_location_lng double precision,
  last_known_location_address text,
  saps_case_number text NOT NULL,
  police_station_name text NOT NULL,
  date_reported timestamptz NOT NULL,
  incident_date_time timestamptz NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE motor_vehicle_theft_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert own motor vehicle theft claims"
  ON motor_vehicle_theft_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Authenticated users can view own motor vehicle theft claims"
  ON motor_vehicle_theft_claims
  FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Brokers can view motor vehicle theft claims in their brokerage"
  ON motor_vehicle_theft_claims
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM broker_users
      WHERE broker_users.id = auth.uid()
      AND broker_users.brokerage_id = motor_vehicle_theft_claims.brokerage_id
    )
  );

CREATE POLICY "Brokers can update motor vehicle theft claims in their brokerage"
  ON motor_vehicle_theft_claims
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM broker_users
      WHERE broker_users.id = auth.uid()
      AND broker_users.brokerage_id = motor_vehicle_theft_claims.brokerage_id
    )
  );
