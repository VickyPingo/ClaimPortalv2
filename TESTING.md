# Testing Guide

## Quick Start - Client Portal (Email Authentication)

1. Open the application
2. Click **"File a Claim"**
3. Make sure **"Email"** is selected (it's the default)
4. Click **"Need an account? Sign up"**
5. Enter your email address and create a password
6. Click **"Create Account"**
7. You're now logged in as a client and can file a test claim

**Note**: Email authentication works out of the box without any additional configuration!

## Testing the Broker Dashboard

The broker dashboard requires a broker user account linked to a brokerage. Here's the simplest way to set this up:

### Option 1: Using Supabase Dashboard (Recommended)

1. **First, sign up with your email:**
   - Click "Broker Login" on the landing page
   - Make sure **"Email"** is selected
   - Click **"Need an account? Sign up"**
   - Enter your email and password
   - Click **"Create Account"**
   - You'll get an error - that's expected (you're not a broker yet)

2. **Get your User ID:**
   - Open [Supabase Dashboard](https://supabase.com/dashboard)
   - Go to: **Authentication → Users**
   - Find your email in the list
   - Copy the **UUID** (looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

3. **Create the broker account:**
   - Go to: **SQL Editor** in Supabase
   - Run this query (replace `YOUR_USER_ID` and `YOUR_EMAIL` with your values):

```sql
INSERT INTO broker_users (id, brokerage_id, phone, name, role)
VALUES (
  'YOUR_USER_ID',
  '00000000-0000-0000-0000-000000000001',
  'YOUR_EMAIL',
  'Your Name',
  'admin'
);
```

4. **Sign in again:**
   - Refresh the application
   - Click "Broker Login"
   - Enter your email and password
   - You now have access to the Broker Dashboard!

### Option 2: Direct SQL Insert (If you know your Auth UUID)

If you already have a Supabase Auth user, run this in the SQL Editor:

```sql
INSERT INTO broker_users (id, brokerage_id, phone, name, role)
VALUES (
  'your-auth-user-uuid-here',
  '00000000-0000-0000-0000-000000000001',
  'your-email@example.com',
  'Test Broker',
  'admin'
);
```

## Alternative: Phone Authentication

If you've configured an SMS provider in Supabase, you can also use phone authentication:

1. Click the **"Phone"** tab on the auth screen
2. Enter your phone number (e.g., `0821234567` or `+27821234567`)
3. Enter the 6-digit OTP code sent to your phone
4. Complete the rest of the broker setup as described above

**Note**: Phone authentication requires Twilio or another SMS provider to be configured in your Supabase project settings.

## Testing Claims Flow

### As a Client:

1. Sign in as a client
2. Choose incident type (Motor Accident or Burst Geyser)
3. Upload required media:
   - **Motor Accident**: Photos + third party details
   - **Burst Geyser**: Video + serial number photo
4. Record a voice note (you can speak in English or Afrikaans)
5. Review and submit

### As a Broker:

1. Sign in to the broker dashboard
2. View all submitted claims in the table
3. Click any claim to view details
4. Update claim status (New → Investigating → Resolved)
5. View location on map, media files, and AI transcript

## Testing White-Labeling

1. Sign in as a broker
2. Click "Settings" in the top right
3. Upload a logo image
4. Choose a brand color
5. Preview the changes
6. Click "Save Settings"

## Troubleshooting

**"Unsupported phone provider" error:**
- Phone authentication requires SMS provider configuration in Supabase
- Use **Email** authentication instead (works out of the box)

**"Invalid credentials" error:**
- Make sure you're using the correct email and password
- If signing up, check that you meet password requirements (min 6 characters)

**"Client not found" error:**
- The client record should be created automatically
- Check that the demo brokerage exists in the database

**Can't access broker dashboard:**
- Verify you have a record in the `broker_users` table
- Check that your user ID matches your Supabase Auth UUID
- Make sure you're using the same email for both auth and broker_users table

**Media upload fails:**
- Check that storage buckets (`claims` and `branding`) exist
- Verify storage policies are configured correctly

**Voice transcription not working:**
- This requires an OpenAI API key configured in Supabase Edge Function secrets
- Without it, the voice note will still be saved, just without transcript
