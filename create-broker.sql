-- Instructions for Creating a Broker Account
--
-- 1. First, authenticate with your phone number through the app:
--    - Go to the landing page
--    - Click "Broker Login"
--    - Enter your phone number and complete OTP verification
--    - You'll see an error because you're not a broker yet - that's expected
--
-- 2. Get your user ID from Supabase:
--    - Go to Supabase Dashboard > Authentication > Users
--    - Find your phone number and copy the UUID (it looks like: 12345678-1234-1234-1234-123456789abc)
--
-- 3. Run this SQL in Supabase SQL Editor:
--    Replace YOUR_USER_ID_HERE with your actual UUID from step 2

INSERT INTO broker_users (id, brokerage_id, phone, name, role)
VALUES (
  'YOUR_USER_ID_HERE',  -- Replace with your actual UUID
  '00000000-0000-0000-0000-000000000001',  -- Demo brokerage ID
  '+27YOUR_PHONE',  -- Your phone number with country code
  'Your Name',  -- Your name
  'admin'
);

-- 4. Refresh the app and sign in again with the same phone number
-- 5. You should now have access to the Broker Dashboard!

-- Example (with fake UUID):
-- INSERT INTO broker_users (id, brokerage_id, phone, name, role)
-- VALUES (
--   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
--   '00000000-0000-0000-0000-000000000001',
--   '+27821234567',
--   'John Smith',
--   'admin'
-- );
