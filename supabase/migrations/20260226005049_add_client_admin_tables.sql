/*
  # Add Client Admin Tables

  1. New Tables
    - `client_documents`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `document_type` (text) - invoice, purchase, contract, other
      - `file_name` (text)
      - `file_url` (text)
      - `uploaded_at` (timestamptz)
      - `created_at` (timestamptz)

    - `broker_messages`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `message_type` (text) - voice_note, text
      - `text_message` (text)
      - `voice_url` (text)
      - `status` (text) - new, read, replied
      - `created_at` (timestamptz)

    - `meeting_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `requested_date` (timestamptz)
      - `reason` (text)
      - `notes` (text)
      - `status` (text) - pending, approved, rejected, completed
      - `broker_response` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Add new fields to client_profiles
    - `address` (text)
    - `city` (text)
    - `province` (text)
    - `postal_code` (text)

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage their own data
*/

-- Create client_documents table
CREATE TABLE IF NOT EXISTS client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL DEFAULT 'other',
  file_name text NOT NULL,
  file_url text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
  ON client_documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON client_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON client_documents FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create broker_messages table
CREATE TABLE IF NOT EXISTS broker_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  text_message text,
  voice_url text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE broker_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON broker_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON broker_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create meeting_requests table
CREATE TABLE IF NOT EXISTS meeting_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  requested_date timestamptz NOT NULL,
  reason text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  broker_response text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meeting requests"
  ON meeting_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meeting requests"
  ON meeting_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meeting requests"
  ON meeting_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add address fields to client_profiles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_profiles' AND column_name = 'address'
  ) THEN
    ALTER TABLE client_profiles ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_profiles' AND column_name = 'city'
  ) THEN
    ALTER TABLE client_profiles ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_profiles' AND column_name = 'province'
  ) THEN
    ALTER TABLE client_profiles ADD COLUMN province text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_profiles' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE client_profiles ADD COLUMN postal_code text;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_client_documents_user_id ON client_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_broker_messages_user_id ON broker_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_user_id ON meeting_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_status ON meeting_requests(status);
