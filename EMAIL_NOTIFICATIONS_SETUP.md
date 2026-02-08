# Email Notifications Setup Guide

The claims system now sends automatic email notifications to brokers when new claims are submitted.

## Features

- **Automatic Email Notifications**: Brokers receive detailed emails when claims are submitted
- **Comprehensive Details**: Emails include all claim information, contact details, location, and transcribed voice statements
- **Beautiful HTML Formatting**: Professional, branded email templates
- **Works with Voice Transcription**: Includes the English transcript of voice notes in the email

## How It Works

1. **Claim Submission**: When a user submits a claim through the public form
2. **Voice Transcription**: The voice note is automatically transcribed to English (if provided)
3. **Email Sent**: A detailed email notification is sent to the broker's notification email address
4. **Broker Reviews**: The broker receives all information needed to start processing the claim

## Setup Instructions

### 1. Configure Notification Email (Required)

Brokers must set their notification email address:

1. Log in to the Broker Dashboard
2. Go to **Settings**
3. Find the **Notification Email** field
4. Enter the email address where you want to receive claim notifications
5. Click **Save Settings**

### 2. Configure Email Service (Required)

The system uses Resend for sending emails. To enable email functionality, configure the Resend API key:

#### Get a Resend API Key

1. Go to [Resend.com](https://resend.com) and create an account
2. Navigate to API Keys section
3. Create a new API key
4. Copy the API key

#### Configure in Supabase

The API key is stored as a secret in your Supabase project:

1. Go to your Supabase project dashboard
2. Navigate to **Settings** > **Edge Functions**
3. Under **Secrets**, add a new secret:
   - Name: `RESEND_API_KEY`
   - Value: Your Resend API key

## Email Content

Each notification email includes:

### Claim Information
- Claim ID
- Incident Type (Motor Accident or Burst Geyser)
- Status
- Submission Date/Time

### Contact Person Details
- Name
- Phone Number
- Email (if provided)

### For Motor Accidents
- Accident Date & Time
- Location (with address)
- Car Condition (Drivable/Not Drivable)
- Preferred Panel Beater Location
- Number of Damage Photos
- Driver Documentation Status
- Third Party Documentation Status

### For Burst Geysers
- Location
- Media uploaded (video/photos)

### Voice Statement
- Full English transcript of the voice note (if available)
- Or link to listen to the voice note

## Testing the System

### Test the Complete Flow

1. **Set Notification Email**: Log in as a broker and configure your notification email in Settings

2. **Submit a Test Claim**:
   - Go to the public claim form
   - Fill in contact details
   - Select an incident type
   - Upload required photos/videos
   - Record a voice statement
   - Submit the claim

3. **Check Your Email**: You should receive a detailed notification email within seconds

4. **Review in Dashboard**: Log in to the broker dashboard to see the claim with all details

## Troubleshooting

### No Email Received

**Check Notification Email Configuration**
- Verify the notification email is set in Broker Settings
- Check for typos in the email address

**Check Resend API Key**
- Ensure `RESEND_API_KEY` is configured in Supabase Edge Function secrets
- Verify the API key is valid and active
- Check Resend dashboard for any errors or rate limits

**Check Spam Folder**
- Notification emails might be filtered as spam initially
- Add the sender to your contacts or safe senders list

**Check Edge Function Logs**
- Go to Supabase Dashboard > Edge Functions
- View logs for `send-claim-notification` function
- Look for any error messages

### Email Sent But Missing Information

**Voice Transcript Missing**
- Verify `OPENAI_API_KEY` is configured (see VOICE_TRANSCRIPTION_SETUP.md)
- Check that the voice note was successfully uploaded
- Review the `transcribe-voice` function logs

**Photos Not Showing**
- Photos are stored in Supabase Storage
- The email shows counts, not embedded images
- Full photos are viewable in the Broker Dashboard

## Email Service Costs

### Resend Pricing (as of 2024)

- **Free Tier**: 100 emails/day, 3,000 emails/month
- **Pro Tier**: $20/month for 50,000 emails/month
- **Enterprise**: Custom pricing for higher volumes

For most insurance brokers, the free tier is sufficient for getting started.

## Security & Privacy

- Email delivery is handled securely via Resend's infrastructure
- No sensitive credentials are exposed in client code
- API keys are stored securely in Supabase secrets
- Emails are sent from a verified domain (you can configure your own domain in Resend)

## Customization

### Change Email Sender

By default, emails are sent from `onboarding@resend.dev`. To use your own domain:

1. Add and verify your domain in Resend
2. Update the `from` field in `/supabase/functions/send-claim-notification/index.ts`
3. Redeploy the edge function

### Customize Email Template

The email template is in `/supabase/functions/send-claim-notification/index.ts`:

- Modify the HTML in the `emailHtml` variable
- Adjust colors to match your brand
- Add or remove sections as needed
- Redeploy the edge function after changes

## Next Steps

After setting up email notifications, you may want to:

1. Set up voice transcription (see VOICE_TRANSCRIPTION_SETUP.md)
2. Customize the email template with your branding
3. Configure a custom sender domain in Resend
4. Set up email analytics in the Resend dashboard
