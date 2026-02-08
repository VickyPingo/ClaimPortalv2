/*
  # Setup Claim Attachments Storage Bucket
  
  1. New Storage Bucket
    - `claim-attachments` bucket for voice notes and photos
    
  2. Security
    - Public bucket allows anonymous uploads (for public claim submissions)
    - Anyone can read files
    - Only authenticated users can update/delete their own files
*/

-- Create claim-attachments storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'claim-attachments',
  'claim-attachments',
  true,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'application/pdf',
    'video/mp4',
    'video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can upload claim attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view claim attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- Allow anyone to upload files (for public claim submissions)
CREATE POLICY "Anyone can upload claim attachments"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'claim-attachments');

-- Allow anyone to view files
CREATE POLICY "Anyone can view claim attachments"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'claim-attachments');

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'claim-attachments' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'claim-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'claim-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
