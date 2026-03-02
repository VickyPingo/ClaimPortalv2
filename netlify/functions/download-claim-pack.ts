import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import PDFDocument from 'pdfkit';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const getFileExtension = (url: string, contentType?: string): string => {
  const urlPath = new URL(url).pathname;
  const urlExt = urlPath.split('.').pop()?.toLowerCase();

  if (urlExt && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg'].includes(urlExt)) {
    return urlExt;
  }

  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
  };

  return contentType ? (mimeToExt[contentType] || 'bin') : 'bin';
};

const sanitizeFilename = (name: string): string => {
  return name.replace(/[^a-z0-9_-]/gi, '_').substring(0, 50);
};

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

function generateClaimReportPDF(claim: any, profile: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).font('Helvetica-Bold').text('INSURANCE CLAIM REPORT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('#666666').text('Generated on ' + new Date().toLocaleString('en-ZA'), { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).fillColor('#000000').font('Helvetica-Bold').text('CLAIM REFERENCE');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Claim ID: ${claim.id}`);
    doc.text(`Submitted: ${formatDate(claim.created_at)}`);
    doc.text(`Status: ${claim.status?.toUpperCase() || 'N/A'}`);
    doc.text(`Incident Type: ${claim.incident_type || 'N/A'}`);
    doc.moveDown(1.5);

    doc.fontSize(14).font('Helvetica-Bold').text('CLAIMANT INFORMATION');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Name: ${profile?.full_name || claim.claimant_name || 'N/A'}`);
    doc.text(`Email: ${profile?.email || claim.claimant_email || 'N/A'}`);
    doc.text(`Phone: ${profile?.cell_number || claim.claimant_phone || 'N/A'}`);
    doc.moveDown(1.5);

    if (claim.location || claim.location_address) {
      doc.fontSize(14).font('Helvetica-Bold').text('LOCATION');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      if (claim.location_address) doc.text(`Address: ${claim.location_address}`);
      if (claim.location) doc.text(`Coordinates: ${claim.location}`);
      if (claim.location_lat && claim.location_lng) {
        doc.text(`Lat/Lng: ${claim.location_lat}, ${claim.location_lng}`);
      }
      doc.moveDown(1.5);
    }

    if (claim.claim_data) {
      doc.fontSize(14).font('Helvetica-Bold').text('CLAIM DETAILS');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      const claimData = typeof claim.claim_data === 'string'
        ? JSON.parse(claim.claim_data)
        : claim.claim_data;

      Object.entries(claimData).forEach(([key, value]) => {
        if (key === 'voice_transcript' || key === 'voice_transcript_updated_at') return;

        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        if (typeof value === 'object' && value !== null) {
          doc.text(`${label}: ${JSON.stringify(value, null, 2)}`);
        } else {
          doc.text(`${label}: ${value || 'N/A'}`);
        }
      });
      doc.moveDown(1.5);
    }

    doc.fontSize(14).font('Helvetica-Bold').text('VOICE TRANSCRIPT');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    if (claim.claim_data?.voice_transcript) {
      doc.text(claim.claim_data.voice_transcript, { align: 'left' });
    } else {
      doc.text('Not transcribed yet');
    }
    doc.moveDown(1.5);

    if (claim.attachments && Array.isArray(claim.attachments) && claim.attachments.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('ATTACHMENTS');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      claim.attachments.forEach((att: any, idx: number) => {
        doc.text(`${idx + 1}. ${att.label || att.kind || 'File'}`);
        if (att.url) doc.text(`   URL: ${att.url}`, { indent: 15 });
      });
    }

    doc.end();
  });
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

    console.log('[DownloadPack] Starting pack creation for claim:', claimId);

    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .maybeSingle();

    if (claimError || !claim) {
      console.error('[DownloadPack] Claim not found:', claimError);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Claim not found' }),
      };
    }

    let profile = null;
    if (claim.user_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email, cell_number')
        .eq('user_id', claim.user_id)
        .maybeSingle();

      profile = profileData;
    }

    const zip = new JSZip();
    const failedFiles: Array<{ kind: string; url: string; error: string }> = [];

    console.log('[DownloadPack] Generating Insurance Claim Report PDF');
    try {
      const pdfBuffer = await generateClaimReportPDF(claim, profile);
      zip.file('Insurance_Claim_Report.pdf', pdfBuffer);
      console.log('[DownloadPack] Insurance Claim Report PDF added to zip');
    } catch (error: any) {
      console.error('[DownloadPack] Failed to generate report:', error);
      failedFiles.push({
        kind: 'report',
        url: 'N/A',
        error: `Failed to generate Insurance Claim Report: ${error.message}`,
      });
    }

    const attachments = claim.attachments || [];
    console.log('[DownloadPack] Processing', attachments.length, 'attachments');

    for (let index = 0; index < attachments.length; index++) {
      const attachment = attachments[index];

      if (!attachment.url) {
        console.warn('[DownloadPack] Skipping attachment without URL:', attachment);
        continue;
      }

      try {
        console.log(`[DownloadPack] Downloading ${index + 1}/${attachments.length}:`, attachment.url);

        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || undefined;
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        const ext = attachment.path
          ? attachment.path.split('.').pop()?.toLowerCase() || getFileExtension(attachment.url, contentType)
          : getFileExtension(attachment.url, contentType);

        const safeLabel = sanitizeFilename(attachment.label || attachment.kind || `file_${index + 1}`);
        const filename = `evidence/${index + 1}_${attachment.kind}_${safeLabel}.${ext}`;

        zip.file(filename, arrayBuffer);
        console.log('[DownloadPack] Added to zip:', filename);
      } catch (error: any) {
        console.error('[DownloadPack] Failed to download attachment:', error);
        failedFiles.push({
          kind: attachment.kind || 'unknown',
          url: attachment.url,
          error: error.message,
        });
      }
    }

    if (claim.claim_data?.voice_transcript) {
      console.log('[DownloadPack] Adding voice transcript');
      zip.file('transcript.txt', claim.claim_data.voice_transcript);
    }

    if (failedFiles.length > 0) {
      console.warn('[DownloadPack] Some files failed to download:', failedFiles.length);
      const manifest = [
        'DOWNLOAD ERRORS',
        '===============',
        '',
        'The following files could not be included in this pack:',
        '',
        ...failedFiles.map((f, i) =>
          `${i + 1}. ${f.kind}\n   URL: ${f.url}\n   Error: ${f.error}\n`
        ),
      ].join('\n');

      zip.file('manifest.txt', manifest);
    }

    console.log('[DownloadPack] Generating ZIP file');
    const zipBlob = await zip.generateAsync({ type: 'nodebuffer' });

    console.log('[DownloadPack] Pack created successfully, size:', zipBlob.length, 'bytes');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="claim_${claimId}.zip"`,
      },
      body: zipBlob.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error: any) {
    console.error('[DownloadPack] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: error.message || 'Internal server error',
      }),
    };
  }
};
