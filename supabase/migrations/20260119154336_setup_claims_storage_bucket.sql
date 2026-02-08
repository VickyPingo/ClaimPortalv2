/*
  # Setup Claims Storage Bucket

  ## Changes
  This migration creates and configures the storage bucket for claim submissions.

  ## 1. Storage Setup
  - Create 'claims' storage bucket if it doesn't exist
  - Allow public uploads (anonymous and authenticated)
  - Allow public reads for brokers to view media

  ## 2. Security
  - Anonymous users can upload files (for claim submissions)
  - Authenticated broker users can view all files
  - Files are organized by user/timestamp for easy management
*/

-- Create the claims bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('claims', 'claims', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can upload claim files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view claim files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view claim files" ON storage.objects;

-- Allow anonymous and authenticated users to upload files
CREATE POLICY "Anyone can upload claim files"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'claims');

-- Allow anyone to view claim files (public bucket)
CREATE POLICY "Anyone can view claim files"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'claims');
