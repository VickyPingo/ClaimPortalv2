/*
  # Create Client Documents System

  1. New Tables
    - `client_documents`
      - `id` (uuid, primary key)
      - `client_user_id` (uuid, references auth.users) - The client who owns the document
      - `brokerage_id` (uuid, references brokerages) - The brokerage the client belongs to
      - `title` (text) - Document title/name
      - `doc_type` (text) - Document type: invoice, proof_of_purchase, warranty, other
      - `file_path` (text) - Path in storage bucket
      - `notes` (text) - Optional notes about the document
      - `created_at` (timestamptz)

  2. Storage
    - Create private storage bucket 'client-documents'
    - Only authenticated users can access their own documents

  3. Security
    - Enable RLS on client_documents table
    - Clients can only view/insert/delete their own documents
    - Brokers can view documents of clients in their brokerage
*/

-- Drop the existing client_documents table if it exists (from previous migration)
DROP TABLE IF EXISTS client_documents CASCADE;

-- Create client_documents table with correct schema
CREATE TABLE IF NOT EXISTS client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brokerage_id uuid REFERENCES brokerages(id) ON DELETE CASCADE,
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'other',
  file_path text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

-- Clients can view their own documents
CREATE POLICY "Clients can view own documents"
  ON client_documents FOR SELECT
  TO authenticated
  USING (auth.uid() = client_user_id);

-- Clients can insert their own documents
CREATE POLICY "Clients can insert own documents"
  ON client_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_user_id);

-- Clients can delete their own documents
CREATE POLICY "Clients can delete own documents"
  ON client_documents FOR DELETE
  TO authenticated
  USING (auth.uid() = client_user_id);

-- Brokers can view documents from clients in their brokerage
CREATE POLICY "Brokers can view client documents in their brokerage"
  ON client_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('broker', 'broker_admin')
      AND profiles.brokerage_id = client_documents.brokerage_id
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_client_documents_client_user_id ON client_documents(client_user_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_brokerage_id ON client_documents(brokerage_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_doc_type ON client_documents(doc_type);
