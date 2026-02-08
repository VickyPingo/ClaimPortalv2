# Voice Transcription Setup Guide

The voice transcription feature automatically transcribes voice notes from Afrikaans to English using OpenAI's Whisper API.

## Features

- **Automatic Transcription**: Converts audio to text using OpenAI Whisper
- **Language Detection**: Configured to detect Afrikaans audio
- **Translation**: Automatically translates from Afrikaans to English
- **Fallback Handling**: Gracefully handles missing API keys

## Setup Instructions

### 1. Get an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (you won't be able to see it again)

### 2. Configure the API Key in Supabase

The API key needs to be configured as an environment secret in your Supabase project:

#### Using Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Settings** > **Edge Functions**
3. Under **Secrets**, add a new secret:
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key

#### Using Supabase CLI:

```bash
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Verify the Configuration

After setting up the API key:

1. Submit a test claim with a voice note
2. Check the claim details in the broker dashboard
3. The transcript should appear under "AI Transcript (English)"

## How It Works

1. **Audio Upload**: When a user submits a voice note, it's uploaded to Supabase Storage
2. **Transcription Request**: The edge function `transcribe-voice` is called with the audio URL
3. **Whisper API**: Transcribes the audio to text (Afrikaans)
4. **Translation**: Uses GPT-4o-mini to translate from Afrikaans to English
5. **Storage**: The English transcript is saved to the database

## Troubleshooting

### No Transcript Appears

- Check if the OPENAI_API_KEY is properly set in Supabase secrets
- Verify your OpenAI API key has sufficient credits
- Check the browser console for error messages
- Review Supabase Edge Function logs

### Transcription Says "API key not configured"

This means the OPENAI_API_KEY environment variable is not set in your Supabase project. Follow the setup instructions above.

### Translation Issues

The system is configured to:
- Detect Afrikaans language (`language: "af"`)
- Translate to English if needed
- Keep English text as-is if already in English

## Cost Considerations

OpenAI Whisper API pricing (as of 2024):
- $0.006 per minute of audio

Typical voice note (1-2 minutes): ~$0.01-0.02 per transcription

## Supported Languages

While configured for Afrikaans, Whisper supports 50+ languages. To change:

Edit `/supabase/functions/transcribe-voice/index.ts` line 56:
```typescript
formData.append("language", "af"); // Change "af" to your language code
```
