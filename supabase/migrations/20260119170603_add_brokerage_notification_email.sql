/*
  # Add Notification Email to Brokerages

  ## Summary
  Adds a notification email field to the brokerages table so brokers can receive
  email notifications when new claims are submitted.

  ## New Columns Added to brokerages table:
  - `notification_email` (text) - Email address for claim notifications
  - `claimant_name` (text) - Name of the person to contact
  - `claimant_phone` (text) - Phone number of the person to contact
  - `claimant_email` (text) - Email of the person to contact (optional)

  ## New Columns Added to claims table:
  - `claimant_name` (text) - Name of the person to contact for this claim
  - `claimant_phone` (text) - Phone number of the person to contact
  - `claimant_email` (text) - Email of the person to contact (optional)

  ## Notes
  - All fields are nullable for backward compatibility
  - The notification_email is where claim notifications will be sent
*/

-- Add notification email to brokerages table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'brokerages' AND column_name = 'notification_email'
  ) THEN
    ALTER TABLE brokerages ADD COLUMN notification_email text;
  END IF;
END $$;

-- Add claimant contact fields to claims table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'claimant_name'
  ) THEN
    ALTER TABLE claims ADD COLUMN claimant_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'claimant_phone'
  ) THEN
    ALTER TABLE claims ADD COLUMN claimant_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'claimant_email'
  ) THEN
    ALTER TABLE claims ADD COLUMN claimant_email text;
  END IF;
END $$;

-- Set a default notification email for the default broker
UPDATE brokerages 
SET notification_email = 'claims@yourbrokerage.com' 
WHERE id = '00000000-0000-0000-0000-000000000001' 
AND notification_email IS NULL;
