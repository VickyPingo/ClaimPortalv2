# Voice Transcription Setup Guide

This guide will walk you through setting up OpenAI-powered voice transcription for your claims system.

## Overview

The transcription system uses:
- **OpenAI Whisper API** for speech-to-text transcription
- **OpenAI GPT-4-mini** for translating Afrikaans to English
- Costs approximately $0.006 per minute of audio

## Step 1: Create an OpenAI Account

1. Go to https://platform.openai.com/signup
2. Create a new account or sign in with an existing one
3. Complete email verification if required

## Step 2: Add Payment Method

OpenAI requires a payment method to use the API:

1. Navigate to https://platform.openai.com/account/billing/overview
2. Click **"Add payment method"**
3. Enter your credit card information
4. Optionally set a **monthly spending limit** (recommended: $10-20 for testing)

## Step 3: Generate an API Key

1. Go to https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Give it a descriptive name: `"Claims Transcription"`
4. **IMPORTANT**: Copy the key immediately - you won't be able to see it again
5. The key will look like: `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 4: Configure Supabase Edge Function Secret

The transcription edge function needs access to your OpenAI key:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ckfdpcdkbcpwqsmhuxfc
2. Navigate to **Settings** → **Edge Functions** (left sidebar)
3. Scroll down to the **"Function Secrets"** section
4. Click **"Add new secret"**
5. Enter:
   - **Secret Name**: `OPENAI_API_KEY`
   - **Secret Value**: Your OpenAI API key (paste the `sk-...` key)
6. Click **"Add Secret"**

## Step 5: Test the Setup

1. Open your claims application
2. Start a new claim
3. Record a voice note
4. Submit the claim
5. View the claim in the broker dashboard
6. Check if the transcription appears in the "Voice Transcription (English)" section

## How It Works

When a user records a voice note:

1. **Audio Upload**: The audio file is uploaded to Supabase Storage
2. **Transcription Request**: The system calls the `transcribe-voice` edge function
3. **Speech-to-Text**: OpenAI Whisper transcribes the audio (expects Afrikaans)
4. **Translation**: GPT-4-mini translates the text to English
5. **Storage**: Both the audio file and transcription are saved to the database
6. **Display**: Brokers can both listen to the audio AND read the transcription

## Pricing

OpenAI Whisper pricing (as of 2024):
- $0.006 per minute of audio transcribed
- Example: 100 one-minute voice notes = $0.60

GPT-4-mini pricing is minimal for short translations (typically <$0.001 per translation)

## Troubleshooting

### "Transcription unavailable - API key not configured"
- The OpenAI API key is not set in Supabase Edge Function secrets
- Follow Step 4 above to add it

### "Transcription unavailable - please check API configuration"
- Your OpenAI API key might be invalid or expired
- You may not have billing set up in your OpenAI account
- Check your OpenAI dashboard for usage and billing status

### Transcription is in the wrong language
- The system is configured to expect Afrikaans audio
- To change this, edit `/supabase/functions/transcribe-voice/index.ts` line 56:
  ```typescript
  formData.append("language", "en"); // Change "af" to "en" for English
  ```

### Audio plays but no transcription appears
- This is normal - transcription runs in the background
- Check the browser console for errors
- Verify the edge function logs in Supabase dashboard

## Configuration Files

The transcription feature has been enabled in:
- ✅ `/src/components/PublicClaimForm.tsx` - Calls the transcription API
- ✅ `/supabase/functions/transcribe-voice/index.ts` - Edge function for transcription
- ✅ `/src/components/ClaimDetail.tsx` - Displays the transcription to brokers

## Additional Notes

- Transcription failures do NOT prevent claim submission
- Audio files are ALWAYS saved, even if transcription fails
- Brokers can always listen to the original audio recording
- The system gracefully handles missing or failed transcriptions
