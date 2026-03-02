# Voice Transcription Setup

## Overview
Voice note transcription is implemented using OpenAI Whisper API via a Netlify serverless function.

## Architecture

### Backend (Netlify Function)
- **File**: `netlify/functions/transcribe-claim-voice.ts`
- **Endpoint**: `/.netlify/functions/transcribe-claim-voice`
- **Method**: POST
- **Input**: `{ claimId: string }`
- **Output**: `{ ok: boolean, transcript?: string, message?: string }`

### Process Flow
1. Client clicks "Transcribe Voice Note" button in Claim Master View
2. Request sent to Netlify function with claim ID
3. Function fetches claim from Supabase
4. Function finds voice note attachment in `claim.attachments`
5. Function downloads audio file from Supabase storage URL
6. Function sends audio to OpenAI Whisper API
7. Function saves transcript to both:
   - `claims.voice_transcript` (top-level column)
   - `claims.claim_data.voice_transcript` (JSON field, with timestamp)
8. Client reloads claim data to display transcript

### Storage
Transcripts are stored in two locations for backwards compatibility:
- **Primary**: `claims.voice_transcript` (text column)
- **Secondary**: `claims.claim_data.voice_transcript` (JSON field)

The UI displays whichever is available (prioritizing `claim_data.voice_transcript`).

## Setup Instructions

### 1. Get an OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-`)

### 2. Configure the API Key in Netlify

#### Using Netlify Dashboard:
1. Go to your Netlify site dashboard
2. Navigate to **Site Settings** > **Environment Variables**
3. Click **Add a variable**
4. Add new variable:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key
   - **Scopes**: All scopes (Production, Deploy Previews, Branch deploys)
5. Click **Create variable**
6. Redeploy your site for changes to take effect

### 3. Verify the Configuration
1. After deployment completes, submit a test claim with a voice note
2. Open the claim in Broker Admin Dashboard
3. Click "Transcribe Voice Note" button
4. Transcript should appear within 5-15 seconds

## Environment Variables

### Required (Must Set Manually)
- `OPENAI_API_KEY` - OpenAI API key with Whisper API access

### Already Available (Auto-configured by Netlify)
- `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Error Messages

| Error Message | Cause | Solution |
|--------------|-------|----------|
| `Missing OPENAI_API_KEY (set in Netlify env vars)` | Environment variable not set | Add `OPENAI_API_KEY` in Netlify dashboard |
| `No voice note attached to this claim` | Claim has no voice attachment | Upload a voice note first |
| `Claim not found` | Invalid claim ID | Check claim ID is correct |
| `OpenAI API error: ...` | OpenAI API issue | Check API key validity, quota, and network |

## UI Components

### Transcription Button
- **Location**: Claim Master View (Broker Admin Dashboard)
- **File**: `src/components/admin/ClaimMasterView.tsx`
- **States**:
  - Default: "Transcribe Voice Note" (blue button with mic icon)
  - Loading: "Transcribing..." (disabled, spinner icon)
  - Error: Shows red error message below button

### Transcript Display
- **Desktop View**: Shows in "Claim Information" section as a gray box with transcript text
- **Mobile View**: Shows below voice note player in "Evidence & Attachments" section
- **Format**: Preserves line breaks with `whitespace-pre-wrap`

## Whisper API Configuration

The function is configured for English language transcription:
- Model: `whisper-1`
- Language: `en` (English)

To change the language, edit `netlify/functions/transcribe-claim-voice.ts` line 75:
```typescript
formData.append('language', 'en'); // Change to your language code
```

Supported languages: Whisper supports 50+ languages including Afrikaans (`af`), Spanish (`es`), French (`fr`), etc.

## Testing

### Manual Test
1. Create a test claim with a voice note (any audio file in .webm format)
2. Open the claim in Broker Admin Dashboard
3. Scroll to "Voice Transcript" section
4. Click "Transcribe Voice Note"
5. Verify:
   - Button shows "Transcribing..." with spinner
   - After 5-15 seconds, transcript appears
   - Transcript text is readable and accurate
   - No error messages shown

### Verify Netlify Function Logs
1. Go to Netlify Dashboard > Functions
2. Click on `transcribe-claim-voice`
3. View recent invocations
4. Check for successful logs:
```
[Transcribe] Starting transcription for claim: <claim-id>
[Transcribe] Downloading audio from: <url>
[Transcribe] Audio downloaded, size: <bytes> bytes
[Transcribe] Sending to OpenAI Whisper API
[Transcribe] Transcript received, length: <chars>
[Transcribe] Transcript saved successfully
```

## Cost Estimation
OpenAI Whisper API pricing (as of 2024):
- $0.006 per minute of audio
- Average claim voice note: 1-3 minutes
- Cost per transcription: ~$0.01-$0.02

## Troubleshooting

### Error: "Missing OPENAI_API_KEY"
**Cause**: Environment variable not set in Netlify
**Solution**:
1. Go to Netlify Dashboard > Site Settings > Environment Variables
2. Add `OPENAI_API_KEY` variable
3. Redeploy site

### Transcript Not Appearing
**Possible Causes**:
- OpenAI API quota exceeded
- Invalid API key
- Network timeout
- Audio file too large or corrupted

**Solutions**:
1. Check Netlify function logs for detailed error
2. Verify API key in OpenAI dashboard
3. Check OpenAI usage/quota limits
4. Test with smaller audio file

### Button Stuck on "Transcribing..."
**Cause**: Function timeout or error without proper response
**Solution**:
1. Refresh the page
2. Check Netlify function logs
3. Retry transcription

## Future Enhancements
- [ ] Auto-transcribe on voice note upload
- [ ] Support multiple languages with auto-detection
- [ ] AI summary generation from transcript
- [ ] Transcript editing capability
- [ ] Speaker diarization for multiple speakers
