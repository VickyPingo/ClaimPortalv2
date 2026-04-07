import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('en-ZA', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

function generatePDFBuffer(claim: any, profile: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('INSURANCE CLAIM REPORT', { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#666666')
      .text(`Generated on ${new Date().toLocaleString('en-ZA')}`, { align: 'center' });
    doc.moveDown(2);

    // Section helper
    const section = (title: string) => {
      doc.moveDown(0.5);
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1d4ed8').text(title.toUpperCase());
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#1d4ed8').lineWidth(1).stroke();
      doc.moveDown(0.5);
      doc.fillColor('#000000');
    };

    // Row helper
    const row = (label: string, value: string) => {
      doc.fontSize(10).font('Helvetica-Bold').text(label + ':', { continued: true, width: 160 });
      doc.font('Helvetica').text('  ' + (value || 'N/A'), { lineBreak: true });
    };

    // Claim Reference
    section('Claim Reference');
    row('Claim ID', claim.id);
    row('Submitted', formatDate(claim.created_at));
    row('Status', claim.status?.toUpperCase() || 'N/A');
    row('Incident Type', (claim.incident_type || 'N/A').replace(/_/g, ' ').toUpperCase());

    // Claimant Information
    section('Claimant Information');
    row('Name', profile?.full_name || claim.claimant_name || 'N/A');
    row('Email', profile?.email || claim.claimant_email || 'N/A');
    row('Phone', profile?.cell_number || claim.claimant_phone || 'N/A');
    row('Policy Number', profile?.policy_number || claim.policy_number || 'N/A');

    // Location
    if (claim.location || claim.location_address) {
      section('Location');
      if (claim.location_address) row('Address', claim.location_address);
      if (claim.location) row('Coordinates', claim.location);
    }

    // Claim Details
    if (claim.claim_data) {
      section('Claim Details');
      const claimData = typeof claim.claim_data === 'string'
        ? JSON.parse(claim.claim_data) : claim.claim_data;

      Object.entries(claimData).forEach(([key, value]) => {
        if (key === 'voice_transcript' || key === 'voice_transcript_updated_at') return;
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const val = typeof value === 'object' ? JSON.stringify(value) : String(value || 'N/A');
        row(label, val);
      });
    }

    // Voice Transcript
    section('Voice Transcript');
    const transcript = claim.claim_data?.voice_transcript || claim.voice_transcript;
    doc.fontSize(10).font('Helvetica')
      .text(transcript || 'Not transcribed yet', { lineBreak: true });

    // Attachments
    if (claim.attachments?.length > 0) {
      section('Attachments');
      claim.attachments.forEach((att: any, idx: number) => {
        doc.fontSize(10).font('Helvetica')
          .text(`${idx + 1}. ${att.label || att.kind || 'File'}: ${att.url || ''}`,
            { lineBreak: true });
      });
    }

    // Footer
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#999999').font('Helvetica')
      .text('This document is confidential and intended for insurance purposes only.', { align: 'center' });

    doc.end();
  });
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) };
  }

  try {
    const { claimId } = JSON.parse(event.body || '{}');
    if (!claimId) {
      return { statusCode: 400, body: JSON.stringify({ message: 'claimId is required' }) };
    }

    const { data: claim, error: claimError } = await supabase
      .from('claims').select('*').eq('id', claimId).maybeSingle();

    if (claimError || !claim) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Claim not found' }) };
    }

    const lookupId = claim.client_id || claim.user_id;
    let profile = null;
    if (lookupId) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email, cell_number, policy_number')
        .eq('user_id', lookupId)
        .maybeSingle();
      profile = profileData;
    }

    const pdfBuffer = await generatePDFBuffer(claim, profile);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="claim-${claimId.substring(0, 8)}.pdf"`,
      },
      body: pdfBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error: any) {
    console.error('[GeneratePDF] Error:', error);
    return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
  }
};
