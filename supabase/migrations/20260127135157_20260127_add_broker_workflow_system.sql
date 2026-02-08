/*
  # Add Broker Workflow System

  ## Overview
  This migration adds comprehensive broker workflow management features including:
  - Unified status system across all claim types
  - Insurer contact management
  - Claim communication timeline
  - Policy number tracking

  ## 1. New Tables

  ### insurers
  Stores insurance company contact information for email submissions
  - id (uuid, primary key)
  - brokerage_id (uuid, foreign key) - Which brokerage this insurer belongs to
  - name (text) - Insurer name (e.g., Santam, Hollard, Discovery)
  - email (text) - Claims submission email address
  - is_active (boolean) - Whether this insurer is currently active
  - created_at (timestamptz)

  ### claim_notes
  Tracks all communication and status changes for claims
  - id (uuid, primary key)
  - claim_id (uuid) - References any claim table
  - claim_type (text) - Which table: motor_accident, burst_geyser, theft, etc.
  - broker_user_id (uuid) - Who made this note
  - note_type (text) - status_change, comment, email_sent, info_requested
  - content (text) - The note content
  - metadata (jsonb) - Additional data (email addresses, file attachments, etc.)
  - created_at (timestamptz)

  ## 2. Status System Updates
  Updates all claim tables to support unified workflow statuses:
  - new - Fresh submission, unopened
  - pending_info - Waiting for client to provide missing information
  - ready_to_submit - Reviewed and ready to send to insurer
  - submitted - Sent to insurer, awaiting outcome
  - resolved - Claim completed

  ## 3. Policy Number Fields
  Adds policy_number field to all claim tables for tracking

  ## 4. Security
  - RLS enabled on all new tables
  - Brokers can only access data from their brokerage
  - Full CRUD policies for authenticated broker users
*/

-- Create insurers table
CREATE TABLE IF NOT EXISTS insurers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id uuid NOT NULL REFERENCES brokerages(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE insurers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can view insurers in their brokerage"
  ON insurers FOR SELECT
  TO authenticated
  USING (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Brokers can insert insurers in their brokerage"
  ON insurers FOR INSERT
  TO authenticated
  WITH CHECK (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Brokers can update insurers in their brokerage"
  ON insurers FOR UPDATE
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

CREATE POLICY "Brokers can delete insurers in their brokerage"
  ON insurers FOR DELETE
  TO authenticated
  USING (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
    )
  );

-- Insert default insurers
INSERT INTO insurers (brokerage_id, name, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Santam', 'claims@santam.co.za'),
  ('00000000-0000-0000-0000-000000000001', 'Hollard', 'claims@hollard.co.za'),
  ('00000000-0000-0000-0000-000000000001', 'Discovery Insure', 'claims@discovery.co.za'),
  ('00000000-0000-0000-0000-000000000001', 'Old Mutual', 'claims@oldmutual.co.za'),
  ('00000000-0000-0000-0000-000000000001', 'Outsurance', 'claims@outsurance.co.za')
ON CONFLICT DO NOTHING;

-- Create claim_notes table
CREATE TABLE IF NOT EXISTS claim_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL,
  claim_type text NOT NULL,
  broker_user_id uuid REFERENCES broker_users(id) ON DELETE SET NULL,
  note_type text NOT NULL CHECK (note_type IN ('status_change', 'comment', 'email_sent', 'info_requested')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE claim_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can view notes in their brokerage"
  ON claim_notes FOR SELECT
  TO authenticated
  USING (
    broker_user_id IN (
      SELECT id FROM broker_users WHERE brokerage_id IN (
        SELECT brokerage_id FROM broker_users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Brokers can insert notes"
  ON claim_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    broker_user_id = auth.uid()
  );

CREATE POLICY "Brokers can update own notes"
  ON claim_notes FOR UPDATE
  TO authenticated
  USING (broker_user_id = auth.uid())
  WITH CHECK (broker_user_id = auth.uid());

CREATE POLICY "Brokers can delete own notes"
  ON claim_notes FOR DELETE
  TO authenticated
  USING (broker_user_id = auth.uid());

-- Add policy_number to claims table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'policy_number'
  ) THEN
    ALTER TABLE claims ADD COLUMN policy_number text;
  END IF;
END $$;

-- Add policy_number to theft_claims table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theft_claims' AND column_name = 'policy_number'
  ) THEN
    ALTER TABLE theft_claims ADD COLUMN policy_number text;
  END IF;
END $$;

-- Add policy_number to motor_vehicle_theft_claims table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'motor_vehicle_theft_claims' AND column_name = 'policy_number'
  ) THEN
    ALTER TABLE motor_vehicle_theft_claims ADD COLUMN policy_number text;
  END IF;
END $$;

-- Add policy_number to structural_damage_claims table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'structural_damage_claims' AND column_name = 'policy_number'
  ) THEN
    ALTER TABLE structural_damage_claims ADD COLUMN policy_number text;
  END IF;
END $$;

-- Add policy_number to all_risk_claims table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'all_risk_claims' AND column_name = 'policy_number'
  ) THEN
    ALTER TABLE all_risk_claims ADD COLUMN policy_number text;
  END IF;
END $$;

-- Update existing status values to match new workflow for claims table
UPDATE claims SET status = 'new' WHERE status NOT IN ('new', 'pending_info', 'ready_to_submit', 'submitted', 'resolved');

-- Update status field in claims table to support new workflow
DO $$
BEGIN
  ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_status_check;
  ALTER TABLE claims ADD CONSTRAINT claims_status_check 
    CHECK (status IN ('new', 'pending_info', 'ready_to_submit', 'submitted', 'resolved'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Update existing status values for theft_claims
UPDATE theft_claims SET status = 'new' WHERE status NOT IN ('new', 'pending_info', 'ready_to_submit', 'submitted', 'resolved');

-- Update status field in theft_claims table
DO $$
BEGIN
  ALTER TABLE theft_claims DROP CONSTRAINT IF EXISTS theft_claims_status_check;
  ALTER TABLE theft_claims ADD CONSTRAINT theft_claims_status_check 
    CHECK (status IN ('new', 'pending_info', 'ready_to_submit', 'submitted', 'resolved'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add status column to motor_vehicle_theft_claims if not exists, then update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'motor_vehicle_theft_claims' AND column_name = 'status'
  ) THEN
    ALTER TABLE motor_vehicle_theft_claims ADD COLUMN status text DEFAULT 'new';
  END IF;
END $$;

UPDATE motor_vehicle_theft_claims SET status = 'new' WHERE status NOT IN ('new', 'pending_info', 'ready_to_submit', 'submitted', 'resolved') OR status IS NULL;

DO $$
BEGIN
  ALTER TABLE motor_vehicle_theft_claims DROP CONSTRAINT IF EXISTS motor_vehicle_theft_claims_status_check;
  ALTER TABLE motor_vehicle_theft_claims ADD CONSTRAINT motor_vehicle_theft_claims_status_check 
    CHECK (status IN ('new', 'pending_info', 'ready_to_submit', 'submitted', 'resolved'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Update existing status values for structural_damage_claims
UPDATE structural_damage_claims SET status = 'new' WHERE status NOT IN ('new', 'pending_info', 'ready_to_submit', 'submitted', 'resolved');

-- Update status field in structural_damage_claims table
DO $$
BEGIN
  ALTER TABLE structural_damage_claims DROP CONSTRAINT IF EXISTS structural_damage_claims_status_check;
  ALTER TABLE structural_damage_claims ADD CONSTRAINT structural_damage_claims_status_check 
    CHECK (status IN ('new', 'pending_info', 'ready_to_submit', 'submitted', 'resolved'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Update existing status values for all_risk_claims
UPDATE all_risk_claims SET status = 'new' WHERE status NOT IN ('new', 'pending_info', 'ready_to_submit', 'submitted', 'resolved');

-- Update status field in all_risk_claims table
DO $$
BEGIN
  ALTER TABLE all_risk_claims DROP CONSTRAINT IF EXISTS all_risk_claims_status_check;
  ALTER TABLE all_risk_claims ADD CONSTRAINT all_risk_claims_status_check 
    CHECK (status IN ('new', 'pending_info', 'ready_to_submit', 'submitted', 'resolved'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;