import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

function generateTextPDF(claim: any, profile: any): string {
  const lines: string[] = [];

  lines.push('============================================');
  lines.push('        INSURANCE CLAIM REPORT');
  lines.push('============================================');
  lines.push('');

  lines.push('CLAIM REFERENCE');
  lines.push(`Claim ID: ${claim.id}`);
  lines.push(`Submitted: ${formatDate(claim.created_at)}`);
  lines.push(`Status: ${claim.status?.toUpperCase() || 'N/A'}`);
  lines.push(`Incident Type: ${claim.incident_type || 'N/A'}`);
  lines.push('');

  lines.push('--------------------------------------------');
  lines.push('CLAIMANT INFORMATION');
  lines.push('--------------------------------------------');
  lines.push(`Name: ${profile?.full_name || claim.claimant_name || 'N/A'}`);
  lines.push(`Email: ${profile?.email || claim.claimant_email || 'N/A'}`);
  lines.push(`Phone: ${profile?.cell_number || claim.claimant_phone || 'N/A'}`);
  lines.push(`Policy Number: ${profile?.policy_number || claim.policy_number || 'N/A'}`);
  lines.push('');

  if (claim.location || claim.location_address) {
    lines.push('--------------------------------------------');
    lines.push('LOCATION');
    lines.push('--------------------------------------------');
    if (claim.location_address) lines.push(`Address: ${claim.location_address}`);
    if (claim.location) lines.push(`Coordinates: ${claim.location}`);
    if (claim.location_lat && claim.location_lng) {
      lines.push(`Lat/Lng: ${claim.location_lat}, ${claim.location_lng}`);
    }
    lines.push('');
  }

  if (claim.claim_data) {
    lines.push('--------------------------------------------');
    lines.push('CLAIM DETAILS');
    lines.push('--------------------------------------------');

    const claimData = typeof claim.claim_data === 'string'
      ? JSON.parse(claim.claim_data)
      : claim.claim_data;

    Object.entries(claimData).forEach(([key, value]) => {
      if (key === 'voice_transcript' || key === 'voice_transcript_updated_at') return;

      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      if (typeof value === 'object' && value !== null) {
        lines.push(`${label}: ${JSON.stringify(value, null, 2)}`);
      } else {
        lines.push(`${label}: ${value || 'N/A'}`);
      }
    });
    lines.push('');
  }

  lines.push('--------------------------------------------');
  lines.push('VOICE TRANSCRIPT');
  lines.push('--------------------------------------------');
  if (claim.claim_data?.voice_transcript) {
    lines.push(claim.claim_data.voice_transcript);
  } else {
    lines.push('Not transcribed yet');
  }
  lines.push('');

  if (claim.attachments && Array.isArray(claim.attachments) && claim.attachments.length > 0) {
    lines.push('--------------------------------------------');
    lines.push('ATTACHMENTS');
    lines.push('--------------------------------------------');
    claim.attachments.forEach((att: any, idx: number) => {
      lines.push(`${idx + 1}. ${att.label || att.kind || 'File'}`);
      if (att.url) lines.push(`   URL: ${att.url}`);
    });
    lines.push('');
  }

  lines.push('============================================');
  lines.push('           END OF REPORT');
  lines.push('============================================');

  return lines.join('\n');
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' }),
    };
  }

  try {
    const { claimId } = JSON.parse(event.body || '{}');

    if (!claimId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'claimId is required' }),
      };
    }

    console.log('[GeneratePDF] Generating report for claim:', claimId);

    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .maybeSingle();

    if (claimError || !claim) {
      console.error('[GeneratePDF] Claim not found:', claimError);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Claim not found' }),
      };
    }

    let profile = null;
    const lookupId = claim.client_id || claim.user_id;
    if (lookupId) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email, cell_number, policy_number')
        .eq('user_id', lookupId)
        .maybeSingle();

      profile = profileData;
    }

    const pdfContent = generateTextPDF(claim, profile);

    console.log('[GeneratePDF] Report generated successfully');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
      body: pdfContent,
    };
  } catch (error: any) {
    console.error('[GeneratePDF] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: error.message || 'Internal server error',
      }),
    };
  }
};
