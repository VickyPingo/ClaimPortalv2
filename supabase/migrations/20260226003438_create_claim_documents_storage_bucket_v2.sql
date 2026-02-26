/*
  # Create claim-documents storage bucket

  ## Overview
  Creates a private storage bucket for claim documents.

  ## Storage Bucket
  - Name: claim-documents
  - Public: false (private bucket - requires signed URLs)
  - File size limit: 10MB
  - Allowed MIME types: PDF, JPEG, PNG

  Note: Storage RLS policies will be managed through Supabase Dashboard
  or require service role permissions.
*/

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'claim-documents',
  'claim-documents',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;