import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function generatePDF(claimId: string): Promise<Buffer | null> {
  try {
    const { data: claim } = await supabase
      .from('claims').select('*').eq('id', claimId).maybeSingle();
    if (!claim) return null;

    const lookupId = claim.client_id || claim.user_id;
    let profile = null;
    if (lookupId) {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, cell_number, policy_number')
        .eq('user_id', lookupId)
        .maybeSingle();
      profile = data;
    }

    const pdfDoc = await PDFDocument.create();
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    let y = height - 50;
    const margin = 50;
    const lineHeight = 18;
    const sectionGap = 12;

    const addText = (text: string, bold = false, size = 10, color = rgb(0, 0, 0)) => {
      const maxWidth = width - margin * 2;
      const font = bold ? boldFont : regularFont;
      const words = String(text).split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, size);
        if (testWidth > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      for (const line of lines) {
        if (y < 80) {
          page = pdfDoc.addPage([595, 842]);
          y = height - 50;
        }
        page.drawText(line, { x: margin, y, size, font, color });
        y -= lineHeight;
      }
    };

    const addRow = (label: string, value: string) => {
      const maxValueWidth = width - margin - 160 - margin; // available width for value
      const safeValue = String(value || 'N/A');

      // Split value into lines that fit within maxValueWidth
      const words = safeValue.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = regularFont.widthOfTextAtSize(testLine, 10);
        if (testWidth > maxValueWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      // Check if we need a new page
      const rowHeight = lines.length * lineHeight;
      if (y - rowHeight < 80) {
        page = pdfDoc.addPage([595, 842]);
        y = height - 50;
      }

      // Draw label on first line only
      page.drawText(`${label}:`, { x: margin, y, size: 10, font: boldFont, color: rgb(0,0,0) });

      // Draw each value line
      lines.forEach((line, idx) => {
        page.drawText(line, { x: margin + 160, y: y - (idx * lineHeight), size: 10, font: regularFont, color: rgb(0,0,0) });
      });

      y -= rowHeight;
    };

    const addSection = (title: string) => {
      y -= sectionGap;
      page.drawText(title, { x: margin, y, size: 12, font: boldFont, color: rgb(0.11, 0.30, 0.73) });
      y -= 4;
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.11, 0.30, 0.73) });
      y -= lineHeight;
    };

    // Title
    const title = 'INSURANCE CLAIM REPORT';
    const titleWidth = boldFont.widthOfTextAtSize(title, 20);
    page.drawText(title, { x: (width - titleWidth) / 2, y, size: 20, font: boldFont, color: rgb(0,0,0) });
    y -= 24;

    const subtitle = `Generated on ${new Date().toLocaleString('en-ZA')}`;
    const subtitleWidth = regularFont.widthOfTextAtSize(subtitle, 9);
    page.drawText(subtitle, { x: (width - subtitleWidth) / 2, y, size: 9, font: regularFont, color: rgb(0.4,0.4,0.4) });
    y -= 30;

    addSection('CLAIM REFERENCE');
    addRow('Claim ID', claim.id);
    addRow('Submitted', claim.created_at ? new Date(claim.created_at).toLocaleString('en-ZA') : 'N/A');
    addRow('Status', (claim.status || 'N/A').toUpperCase());
    addRow('Incident Type', (claim.incident_type || 'N/A').replace(/_/g, ' ').toUpperCase());

    addSection('CLAIMANT INFORMATION');
    addRow('Name', profile?.full_name || claim.claimant_name || 'N/A');
    addRow('Email', profile?.email || claim.claimant_email || 'N/A');
    addRow('Phone', profile?.cell_number || claim.claimant_phone || 'N/A');
    addRow('Policy Number', profile?.policy_number || claim.policy_number || 'N/A');

    if (claim.claim_data?.location_address || claim.location) {
      addSection('LOCATION');
      addRow('Address', claim.claim_data?.location_address || claim.location || 'N/A');
    }

    if (claim.claim_data) {
      addSection('CLAIM DETAILS');
      const data = typeof claim.claim_data === 'string'
        ? JSON.parse(claim.claim_data) : claim.claim_data;
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'voice_transcript' || key === 'voice_transcript_updated_at') return;
        if (value === null || value === undefined || value === '') return;
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const val = typeof value === 'object' ? JSON.stringify(value).substring(0, 80) : String(value);
        addRow(label, val);
      });
    }

    const transcript = claim.claim_data?.voice_transcript || claim.voice_transcript;
    if (transcript) {
      addSection('VOICE TRANSCRIPT');
      // Split transcript into lines of ~80 chars
      const words = transcript.split(' ');
      let line = '';
      for (const word of words) {
        if ((line + word).length > 80) {
          addText(line.trim());
          line = word + ' ';
        } else {
          line += word + ' ';
        }
      }
      if (line.trim()) addText(line.trim());
    }

    if (claim.attachments?.length > 0) {
      addSection('ATTACHMENTS');
      claim.attachments.forEach((att: any, idx: number) => {
        addText(`${idx + 1}. ${att.label || att.kind || 'File'}`);
      });
    }

    // Footer
    y = 40;
    page.drawLine({ start: { x: margin, y: y + 15 }, end: { x: width - margin, y: y + 15 }, thickness: 0.5, color: rgb(0.8,0.8,0.8) });
    page.drawText('This document is confidential and intended for insurance purposes only.', {
      x: margin, y, size: 8, font: regularFont, color: rgb(0.6,0.6,0.6)
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (err) {
    console.error('PDF generation error:', err);
    return null;
  }
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

    const pdfBuffer = await generatePDF(claimId);

    if (!pdfBuffer) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Claim not found or PDF generation failed' }) };
    }

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
