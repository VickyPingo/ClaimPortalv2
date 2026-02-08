/*
  # Enhanced Motor Accident Claim Fields

  ## Summary
  Adds comprehensive fields for motor accident claims including document photos, 
  damage documentation, vehicle condition, and service provider details.

  ## New Columns Added to claims table:
  
  ### Date and Time
  - `accident_date_time` (timestamptz) - When the accident occurred
  
  ### Location Details
  - `location_address` (text) - Human-readable street address
  
  ### Driver Documentation
  - `driver_license_photo_url` (text) - Photo of driver's license
  - `license_disk_photo_url` (text) - Photo of vehicle license disk
  
  ### Third Party Documentation
  - `third_party_license_photo_url` (text) - Photo of third party driver's license
  - `third_party_disk_photo_url` (text) - Photo of third party license disk
  
  ### Damage Documentation
  - `damage_photo_urls` (jsonb) - Array of 4 damage photos
  
  ### Vehicle Condition
  - `car_condition` (text) - Either 'drivable' or 'not_drivable'
  
  ### Service Provider
  - `panel_beater_location` (text) - Selected panel beater location
  
  ## Notes
  - All new fields are nullable to maintain backward compatibility
  - These fields are primarily for motor accident claims
*/

-- Add new columns to claims table
DO $$ 
BEGIN
  -- Accident date and time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'accident_date_time'
  ) THEN
    ALTER TABLE claims ADD COLUMN accident_date_time timestamptz;
  END IF;

  -- Location address
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'location_address'
  ) THEN
    ALTER TABLE claims ADD COLUMN location_address text;
  END IF;

  -- Driver documentation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'driver_license_photo_url'
  ) THEN
    ALTER TABLE claims ADD COLUMN driver_license_photo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'license_disk_photo_url'
  ) THEN
    ALTER TABLE claims ADD COLUMN license_disk_photo_url text;
  END IF;

  -- Third party documentation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'third_party_license_photo_url'
  ) THEN
    ALTER TABLE claims ADD COLUMN third_party_license_photo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'third_party_disk_photo_url'
  ) THEN
    ALTER TABLE claims ADD COLUMN third_party_disk_photo_url text;
  END IF;

  -- Damage photos
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'damage_photo_urls'
  ) THEN
    ALTER TABLE claims ADD COLUMN damage_photo_urls jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Car condition
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'car_condition'
  ) THEN
    ALTER TABLE claims ADD COLUMN car_condition text;
  END IF;

  -- Panel beater location
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'panel_beater_location'
  ) THEN
    ALTER TABLE claims ADD COLUMN panel_beater_location text;
  END IF;
END $$;