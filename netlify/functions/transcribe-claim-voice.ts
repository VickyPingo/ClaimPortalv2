import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ ok: false, message: 'Method not allowed' }),
    };
  }

  try {
    const { claimId } = JSON.parse(event.body || '{}');

    if (!claimId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, message: 'claimId is required' }),
      };
    }

    console.log('[Transcribe] Starting transcription for claim:', claimId);

    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('id, attachments, claim_data')
      .eq('id', claimId)
      .maybeSingle();

    if (claimError || !claim) {
      console.error('[Transcribe] Claim not found:', claimError);
      return {
        statusCode: 404,
        body: JSON.stringify({ ok: false, message: 'Claim not found' }),
      };
    }

    const attachments = claim.attachments || [];
    const voiceNote = attachments.find((a: any) => a.kind === 'voice_note');

    if (!voiceNote || !voiceNote.url) {
      console.log('[Transcribe] No voice note attached');
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, message: 'No voice note attached to this claim' }),
      };
    }

    if (!openaiApiKey) {
      console.error('[Transcribe] OPENAI_API_KEY not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, message: 'Missing OPENAI_API_KEY (set in Netlify env vars)' }),
      };
    }

    console.log('[Transcribe] Downloading audio from:', voiceNote.url);
    const audioResponse = await fetch(voiceNote.url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }

    const audioBlob = await audioResponse.blob();
    console.log('[Transcribe] Audio downloaded, size:', audioBlob.size, 'bytes');

    const formData = new FormData();
    formData.append('file', audioBlob, 'voice_note.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    console.log('[Transcribe] Sending to OpenAI Whisper API');
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error('[Transcribe] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${transcriptionResponse.statusText}`);
    }

    const transcriptionResult = await transcriptionResponse.json();
    const transcript = transcriptionResult.text;

    console.log('[Transcribe] Transcript received, length:', transcript.length);

    const updatedClaimData = {
      ...(claim.claim_data || {}),
      voice_transcript: transcript,
      voice_transcript_updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('claims')
      .update({
        voice_transcript: transcript,
        claim_data: updatedClaimData
      })
      .eq('id', claimId);

    if (updateError) {
      console.error('[Transcribe] Failed to update claim:', updateError);
      throw new Error('Failed to save transcript to database');
    }

    console.log('[Transcribe] Transcript saved successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        transcript,
      }),
    };
  } catch (error: any) {
    console.error('[Transcribe] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        message: error.message || 'Internal server error',
      }),
    };
  }
};
