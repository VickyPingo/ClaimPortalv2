import { supabase } from "./supabase";

type AttachmentRef = {
  bucket: string;
  path: string;
  url?: string;
  kind?: string;
  label?: string;
};

export async function submitClaimUnified(params: {
  claimType: string;
  claimData: Record<string, any>;
  attachments?: AttachmentRef[];
  claimantName?: string;
  claimantEmail?: string;
  claimantPhone?: string;
}) {
  // 1. Get authenticated user
  const { data: authRes, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authRes?.user) {
    throw new Error("User not authenticated");
  }

  const uid = authRes.user.id;
  if (!uid) {
    throw new Error("User ID not available");
  }

  const user = authRes.user;

  // 2. Load profile (single source of truth)
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("user_id, role, brokerage_id, full_name, email, cell_number, policy_number")
    .eq("user_id", uid)
    .maybeSingle();

  if (profErr) throw profErr;
  if (!profile) throw new Error("Profile not found");

  // 3. Snapshot profile data (stored permanently with claim)
  // Priority: explicit params > claimData > profile > user metadata
  // NEVER use email as name - keep it as null if no real name exists
  const rawName = params.claimantName ??
    params.claimData?.claimantName ??
    params.claimData?.name ??
    profile.full_name ??
    user.user_metadata?.full_name ??
    null;

  // Defensive: If the name looks like an email, reject it
  const isEmailLike = (str: string | null) => {
    if (!str) return false;
    return str.includes('@') || str.includes('.co.') || str.includes('.com');
  };

  const finalClaimantName = (rawName && !isEmailLike(rawName)) ? rawName : null;

  const finalClaimantEmail = params.claimantEmail ??
    params.claimData?.claimantEmail ??
    params.claimData?.email ??
    profile.email ??
    user.email ??
    null;

  const finalClaimantPhone = params.claimantPhone ??
    params.claimData?.claimantPhone ??
    params.claimData?.phone ??
    profile.cell_number ??
    user.user_metadata?.phone ??
    null;

  const claimantSnapshot = {
    full_name: finalClaimantName,
    email: finalClaimantEmail,
    cell_number: finalClaimantPhone,
    policy_number: profile.policy_number ?? null,
    role: profile.role ?? null,
    brokerage_id: profile.brokerage_id ?? null,
  };

  // 4. Extract location from claim data
  const finalLocation = params.claimData?.location_address ??
    params.claimData?.locationAddress ??
    params.claimData?.location ??
    null;

  // 5. Build unified payload
  const payload = {
    incident_type: params.claimType,
    client_id: uid,
    brokerage_id: profile.brokerage_id,
    status: "new",
    claimant_name: finalClaimantName,
    claimant_email: finalClaimantEmail,
    claimant_phone: finalClaimantPhone,
    policy_number: profile.policy_number ?? null,
    location: finalLocation,
    claimant_snapshot: claimantSnapshot,
    claim_data: params.claimData ?? {},
    attachments: params.attachments ?? [],
  };

  // 6. Insert claim
  const { data, error } = await supabase
    .from("claims")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;

  // 7. Process voice note transcription if any voice attachments exist
  const voiceAttachments = params.attachments?.filter(att => att.kind === 'voice_note');
  if (voiceAttachments && voiceAttachments.length > 0 && data?.id) {
    // Transcribe asynchronously (don't block claim submission)
    transcribeVoiceNotes(data.id, voiceAttachments).catch(err => {
      console.error('Voice transcription failed:', err);
    });
  }

  // 8. Generate AI summary asynchronously
  if (data?.id) {
    generateClaimSummary(data.id).catch(err => {
      console.error('AI summary generation failed:', err);
    });
  }

  return data;
}

async function transcribeVoiceNotes(claimId: string, voiceAttachments: AttachmentRef[]) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase credentials not configured');
      return;
    }

    // Transcribe the first voice note
    const voiceNote = voiceAttachments[0];
    const audioUrl = voiceNote.url;

    if (!audioUrl) {
      console.error('Voice note has no URL');
      return;
    }

    // Call the transcribe-voice edge function
    const response = await fetch(`${supabaseUrl}/functions/v1/transcribe-voice`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audioUrl }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Transcription API error:', response.status, errorText);
      return;
    }

    const result = await response.json();
    const transcript = result.transcript || '[Transcription unavailable]';

    // Update the claim with the transcript
    const { error: updateError } = await supabase
      .from('claims')
      .update({ voice_transcript: transcript })
      .eq('id', claimId);

    if (updateError) {
      console.error('Failed to update claim with transcript:', updateError);
      return;
    }

    // After transcription completes, regenerate AI summary with the new transcript
    generateClaimSummary(claimId).catch(err => {
      console.error('AI summary generation after transcription failed:', err);
    });
  } catch (error) {
    console.error('Transcription process error:', error);
  }
}

async function generateClaimSummary(claimId: string) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase credentials not configured');
      return;
    }

    // Call the generate-claim-summary edge function
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-claim-summary`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ claimId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI summary API error:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('AI summary generated:', result.summary);
  } catch (error) {
    console.error('AI summary generation process error:', error);
  }
}
