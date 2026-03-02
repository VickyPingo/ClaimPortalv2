-- Backfill Script: Sync claims.claimant_name with profiles.full_name
-- Purpose: Update all claims where claimant_name is missing, empty, or contains an email address
-- Run this in Supabase SQL Editor

UPDATE public.claims c
SET claimant_name = p.full_name
FROM public.profiles p
WHERE p.id = c.user_id
  AND (
    c.claimant_name IS NULL
    OR BTRIM(c.claimant_name) = ''
    OR POSITION('@' IN c.claimant_name) > 0
    OR c.claimant_name = c.claimant_email
  )
  AND p.full_name IS NOT NULL
  AND BTRIM(p.full_name) != ''
  AND POSITION('@' IN p.full_name) = 0;
