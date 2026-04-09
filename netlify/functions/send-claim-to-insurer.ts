import type { Handler } from '@netlify/functions';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { to, subject, message, claimId, claimantName, incidentType, attachments } = JSON.parse(event.body || '{}');

    if (!to || !subject || !attachments) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const emailAttachments: { filename: string; content: string }[] = [];

    // Generate and attach the claim report PDF
    try {
      // Use DEPLOY_URL or URL env var, fallback to known production URL
      const baseUrl = process.env.DEPLOY_URL ||
                      process.env.URL ||
                      'https://independi.claimsportal.co.za';

      console.log('📄 Generating PDF report, baseUrl:', baseUrl);

      const reportResponse = await fetch(
        `${baseUrl}/.netlify/functions/generate-claim-report`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimId }),
        }
      );

      console.log('📄 Report response status:', reportResponse.status);

      if (reportResponse.ok) {
        const contentType = reportResponse.headers.get('content-type') || '';
        console.log('📄 Report content-type:', contentType);

        const reportBuffer = await reportResponse.arrayBuffer();
        console.log('📄 Report buffer size:', reportBuffer.byteLength, 'bytes');

        if (reportBuffer.byteLength > 0) {
          const reportBase64 = Buffer.from(reportBuffer).toString('base64');
          emailAttachments.push({
            filename: `claim-report-${claimId.substring(0, 8)}.pdf`,
            content: reportBase64,
          });
          console.log('✅ PDF report attached successfully');
        } else {
          console.warn('⚠️ Report buffer was empty');
        }
      } else {
        const errorText = await reportResponse.text();
        console.error('❌ Report generation failed:', reportResponse.status, errorText);
      }
    } catch (err) {
      console.error('❌ Failed to generate/attach claim report:', err);
    }

    for (const att of attachments) {
      if (att.kind === 'voice_note' || att.kind === 'leak_video') continue;

      try {
        const response = await fetch(att.url);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const filename = att.path.split('/').pop() || att.label;
        emailAttachments.push({ filename, content: base64 });
      } catch (err) {
        console.warn('Failed to fetch attachment:', att.url, err);
      }
    }

    console.log('📧 Sending email with', emailAttachments.length, 'attachments:',
      emailAttachments.map(a => a.filename).join(', '));

    const sendResult = await resend.emails.send({
      from: 'Claims Portal <noreply@claimsportal.co.za>', // ✅ Fixed: was onboarding@resend.dev
      to: [to],
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1d4ed8;">Insurance Claim Notification</h2>
          <p><strong>Claim Reference:</strong> ${claimId}</p>
          <p><strong>Claimant:</strong> ${claimantName}</p>
          <p><strong>Incident Type:</strong> ${incidentType}</p>
          <hr style="margin: 24px 0;" />
          <div style="white-space: pre-wrap;">${message}</div>
          <hr style="margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px;">
            This email was sent from the Claims Portal.
            ${emailAttachments.length} file(s) attached.
          </p>
        </div>
      `,
      attachments: emailAttachments,
    });

    console.log('Resend result:', JSON.stringify(sendResult));

    if (sendResult.error) {
      throw new Error(sendResult.error.message);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, attachmentCount: emailAttachments.length }),
    };
  } catch (error: any) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Failed to send email' }),
    };
  }
};

