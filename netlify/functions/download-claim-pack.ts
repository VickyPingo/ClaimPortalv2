import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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

async function generateClaimReportPDF(claim: any, profile: any): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let yPosition = height - 50;
  const margin = 50;
  const lineHeight = 15;

  const drawText = (text: string, options: { bold?: boolean; size?: number; color?: any } = {}) => {
    const textFont = options.bold ? fontBold : font;
    const textSize = options.size || 10;
    const textColor = options.color || rgb(0, 0, 0);

    page.drawText(text, {
      x: margin,
      y: yPosition,
      size: textSize,
      font: textFont,
      color: textColor,
    });
    yPosition -= lineHeight;
  };

  const addSpace = (lines = 1) => {
    yPosition -= lineHeight * lines;
  };

  drawText('INSURANCE CLAIM REPORT', { bold: true, size: 20 });
  drawText(`Generated on ${new Date().toLocaleString('en-ZA')}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
  addSpace(2);

  drawText('CLAIM REFERENCE', { bold: true, size: 14 });
  addSpace(0.5);
  drawText(`Claim ID: ${claim.id}`);
  drawText(`Submitted: ${formatDate(claim.created_at)}`);
  drawText(`Status: ${claim.status?.toUpperCase() || 'N/A'}`);
  drawText(`Incident Type: ${claim.incident_type || 'N/A'}`);
  addSpace(1.5);

  drawText('CLAIMANT INFORMATION', { bold: true, size: 14 });
  addSpace(0.5);
  drawText(`Name: ${profile?.full_name || claim.claimant_name || 'N/A'}`);
  drawText(`Email: ${profile?.email || claim.claimant_email || 'N/A'}`);
  drawText(`Phone: ${profile?.cell_number || claim.claimant_phone || 'N/A'}`);
  addSpace(1.5);

  if (claim.location || claim.location_address) {
    drawText('LOCATION', { bold: true, size: 14 });
    addSpace(0.5);
    if (claim.location_address) drawText(`Address: ${claim.location_address}`);
    if (claim.location) drawText(`Coordinates: ${claim.location}`);
    if (claim.location_lat && claim.location_lng) {
      drawText(`Lat/Lng: ${claim.location_lat}, ${claim.location_lng}`);
    }
    addSpace(1.5);
  }

  if (claim.claim_data) {
    drawText('CLAIM DETAILS', { bold: true, size: 14 });
    addSpace(0.5);

    const claimData = typeof claim.claim_data === 'string'
      ? JSON.parse(claim.claim_data)
      : claim.claim_data;

    Object.entries(claimData).forEach(([key, value]) => {
      if (key === 'voice_transcript' || key === 'voice_transcript_updated_at') return;

      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      if (typeof value === 'object' && value !== null) {
        drawText(`${label}: ${JSON.stringify(value)}`);
      } else {
        drawText(`${label}: ${value || 'N/A'}`);
      }
    });
    addSpace(1.5);
  }

  drawText('VOICE TRANSCRIPT', { bold: true, size: 14 });
  addSpace(0.5);
  if (claim.claim_data?.voice_transcript || claim.voice_transcript) {
    const transcript = claim.claim_data?.voice_transcript || claim.voice_transcript;
    const lines = transcript.split('\n');
    lines.forEach((line: string) => {
      if (line.length > 80) {
        const words = line.split(' ');
        let currentLine = '';
        words.forEach((word: string) => {
          if ((currentLine + word).length > 80) {
            drawText(currentLine);
            currentLine = word + ' ';
          } else {
            currentLine += word + ' ';
          }
        });
        if (currentLine) drawText(currentLine);
      } else {
        drawText(line);
      }
    });
  } else {
    drawText('Not transcribed yet');
  }
  addSpace(1.5);

  if (claim.attachments && Array.isArray(claim.attachments) && claim.attachments.length > 0) {
    drawText('EVIDENCE & ATTACHMENTS', { bold: true, size: 14 });
    addSpace(0.5);
    claim.attachments.forEach((att: any, idx: number) => {
      drawText(`${idx + 1}. ${att.label || att.kind || 'File'}`);
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
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
    if (claim.client_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email, cell_number')
        .eq('user_id', claim.client_id)
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
