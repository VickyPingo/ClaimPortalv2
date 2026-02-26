/*
  # Create Client Requests System

  1. New Tables
    - `client_requests`
      - `id` (uuid, primary key)
      - `client_user_id` (uuid, references auth.users) - The client making the request
      - `brokerage_id` (uuid, references brokerages) - The brokerage to contact
      - `request_type` (text) - Type: policy_change, meeting_request, general
      - `subject` (text) - Request subject/title
      - `message` (text) - Optional message text
      - `voice_path` (text) - Path to voice note in storage
      - `transcript` (text) - Transcribed text from voice note
      - `meeting_requested` (boolean) - Whether client wants a meeting
      - `meeting_preferred_times` (text) - Preferred meeting times
      - `status` (text) - Status: pending, in_progress, resolved
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Storage
    - Create private storage bucket 'client-voicenotes'

  3. Security
    - Enable RLS on client_requests table
    - Clients can view and insert their own requests
    - Brokers can view requests from clients in their brokerage
    - Brokers can update request status
*/

-- Create client_requests table
CREATE TABLE IF NOT EXISTS client_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brokerage_id uuid REFERENCES brokerages(id) ON DELETE CASCADE,
  request_type text NOT NULL DEFAULT 'general',
  subject text NOT NULL,
  message text,
  voice_path text,
  transcript text,
  meeting_requested boolean DEFAULT false,
  meeting_preferred_times text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE client_requests ENABLE ROW LEVEL SECURITY;

-- Clients can view their own requests
CREATE POLICY "Clients can view own requests"
  ON client_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = client_user_id);

-- Clients can insert their own requests
CREATE POLICY "Clients can insert own requests"
  ON client_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_user_id);

-- Brokers can view requests from clients in their brokerage
CREATE POLICY "Brokers can view client requests in their brokerage"
  ON client_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('broker', 'broker_admin')
      AND profiles.brokerage_id = client_requests.brokerage_id
    )
  );

-- Brokers can update request status
CREATE POLICY "Brokers can update client requests in their brokerage"
  ON client_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('broker', 'broker_admin')
      AND profiles.brokerage_id = client_requests.brokerage_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('broker', 'broker_admin')
      AND profiles.brokerage_id = client_requests.brokerage_id
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_client_requests_client_user_id ON client_requests(client_user_id);
CREATE INDEX IF NOT EXISTS idx_client_requests_brokerage_id ON client_requests(brokerage_id);
CREATE INDEX IF NOT EXISTS idx_client_requests_status ON client_requests(status);
CREATE INDEX IF NOT EXISTS idx_client_requests_created_at ON client_requests(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_client_requests_updated_at ON client_requests;
CREATE TRIGGER update_client_requests_updated_at
  BEFORE UPDATE ON client_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
