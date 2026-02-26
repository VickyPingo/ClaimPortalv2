/*
  # Create claim_documents table for document management

  ## Overview
  This migration creates a claim_documents table to store references to uploaded
  documents for insurance claims. Documents are stored in Supabase Storage and
  this table tracks metadata and access control.

  ## 1. New Table: claim_documents

  ### Columns
  - `id` (uuid, primary key) - Unique document identifier
  - `claim_id` (uuid) - References claims(id), links document to claim
  - `uploaded_by` (uuid) - References auth.users(id), tracks who uploaded
  - `doc_type` (text) - Document type: police_report, invoice, photo, other
  - `file_path` (text) - Storage path in claim-documents bucket
  - `notes` (text, optional) - Optional notes about the document
  - `created_at` (timestamptz) - Upload timestamp

  ## 2. Security

  ### Row Level Security (RLS)
  - Clients can view documents for their own claims
  - Clients can upload documents for their own claims
  - Brokers can view documents for claims in their brokerage
  - Brokers can upload documents for claims in their brokerage
  - Super admins have full access

  ## 3. Indexes
  - Index on claim_id for efficient document lookups per claim
  - Index on uploaded_by for tracking user uploads

  ## 4. Storage Bucket
  Note: Storage bucket 'claim-documents' and its RLS policies will be created
  in a separate migration for clarity.
*/

-- Create claim_documents table
CREATE TABLE IF NOT EXISTS claim_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  doc_type text NOT NULL CHECK (doc_type IN ('police_report', 'invoice', 'photo', 'other')),
  file_path text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_claim_documents_claim_id ON claim_documents(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_documents_uploaded_by ON claim_documents(uploaded_by);

-- Enable Row Level Security
ALTER TABLE claim_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Clients can view documents for their own claims
CREATE POLICY "Clients can view own claim documents"
  ON claim_documents FOR SELECT
  TO authenticated
  USING (
    claim_id IN (
      SELECT id FROM claims WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Clients can insert documents for their own claims
CREATE POLICY "Clients can upload own claim documents"
  ON claim_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND claim_id IN (
      SELECT id FROM claims WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Brokers can view documents for claims in their brokerage
CREATE POLICY "Brokers can view brokerage claim documents"
  ON claim_documents FOR SELECT
  TO authenticated
  USING (
    claim_id IN (
      SELECT id FROM claims
      WHERE brokerage_id IN (
        SELECT brokerage_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policy: Brokers can upload documents for claims in their brokerage
CREATE POLICY "Brokers can upload brokerage claim documents"
  ON claim_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    claim_id IN (
      SELECT id FROM claims
      WHERE brokerage_id IN (
        SELECT brokerage_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policy: Super admins can view all documents
CREATE POLICY "Super admins can view all claim documents"
  ON claim_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- RLS Policy: Super admins can upload documents to any claim
CREATE POLICY "Super admins can upload to any claim"
  ON claim_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );