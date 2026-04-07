import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getBrokerageEmail(brokerageId: string): Promise<{ email: string | null; name: string }> {
  const { data } = await supabase
    .from('brokerages')
    .select('name, notification_email')
    .eq('id', brokerageId)
    .maybeSingle();
  return { email: data?.notification_email || null, name: data?.name || 'Your Brokerage' };
}

async function getClientName(clientUserId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', clientUserId)
    .maybeSingle();
  return data?.full_name || 'A client';
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { type, claimId, requestId, fileUpload } = JSON.parse(event.body || '{}');

    // ─── CLAIM NOTIFICATION ───────────────────────────────────────────
    if (type === 'claim' || claimId) {
      const { data: claim } = await supabase
        .from('claims')
        .select('*, brokerages(name, notification_email)')
        .eq('id', claimId)
        .maybeSingle();

      if (!claim) return { statusCode: 404, body: JSON.stringify({ error: 'Claim not found' }) };

      const brokerageName = claim.brokerages?.name || 'Your Brokerage';
      const notificationEmail = claim.brokerages?.notification_email;
      if (!notificationEmail) return { statusCode: 200, body: JSON.stringify({ skipped: true }) };

      const incidentLabel = (claim.incident_type || 'Unknown')
        .replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      const submittedDate = new Date(claim.created_at).toLocaleString('en-ZA', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      const claimRef = claimId.substring(0, 8).toUpperCase();

      await resend.emails.send({
        from: 'Claims Portal <onboarding@resend.dev>',
        to: [notificationEmail],
        subject: `🆕 New Claim — ${incidentLabel} | Ref: ${claimRef}`,
        html: buildEmail(brokerageName, '🆕 New Claim Submitted', '#1d4ed8', [
          { label: 'Reference', value: claimRef },
          { label: 'Claim Type', value: incidentLabel },
          { label: 'Claimant', value: claim.claimant_name || 'Unknown' },
          { label: 'Email', value: claim.claimant_email || 'Not provided' },
          { label: 'Phone', value: claim.claimant_phone || 'Not provided' },
          { label: 'Submitted', value: submittedDate },
          { label: 'Status', value: 'NEW', badge: true },
        ], 'View Claim in Dashboard'),
      });

      return { statusCode: 200, body: JSON.stringify({ success: true, sentTo: notificationEmail }) };
    }

    // ─── CLIENT REQUEST NOTIFICATION ─────────────────────────────────
    if (type === 'request' || requestId) {
      const { data: request } = await supabase
        .from('client_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (!request) return { statusCode: 404, body: JSON.stringify({ error: 'Request not found' }) };

      const { email: notificationEmail, name: brokerageName } = await getBrokerageEmail(request.brokerage_id);
      if (!notificationEmail) return { statusCode: 200, body: JSON.stringify({ skipped: true }) };

      const clientName = await getClientName(request.client_user_id);
      const requestDate = new Date(request.created_at).toLocaleString('en-ZA', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });

      await resend.emails.send({
        from: 'Claims Portal <onboarding@resend.dev>',
        to: [notificationEmail],
        subject: `💬 New Client Request — ${request.request_type || 'General'} from ${clientName}`,
        html: buildEmail(brokerageName, '💬 New Client Request', '#7c3aed', [
          { label: 'From', value: clientName },
          { label: 'Request Type', value: (request.request_type || 'General').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) },
          { label: 'Subject', value: request.subject || 'No subject' },
          { label: 'Message', value: request.message || 'No message' },
          { label: 'Meeting Requested', value: request.meeting_requested ? 'Yes' : 'No' },
          { label: 'Submitted', value: requestDate },
          { label: 'Status', value: 'NEW', badge: true },
        ], 'View Request in Dashboard'),
      });

      return { statusCode: 200, body: JSON.stringify({ success: true, sentTo: notificationEmail }) };
    }

    // ─── FILE UPLOAD NOTIFICATION ─────────────────────────────────────
    if (type === 'file' || fileUpload) {
      const { brokerageId, clientUserId, fileName, fileType } = fileUpload || {};
      if (!brokerageId) return { statusCode: 400, body: JSON.stringify({ error: 'brokerageId required' }) };

      const { email: notificationEmail, name: brokerageName } = await getBrokerageEmail(brokerageId);
      if (!notificationEmail) return { statusCode: 200, body: JSON.stringify({ skipped: true }) };

      const clientName = await getClientName(clientUserId);

      await resend.emails.send({
        from: 'Claims Portal <onboarding@resend.dev>',
        to: [notificationEmail],
        subject: `📎 New File Uploaded by ${clientName}`,
        html: buildEmail(brokerageName, '📎 New File Uploaded', '#059669', [
          { label: 'From', value: clientName },
          { label: 'File Name', value: fileName || 'Unknown file' },
          { label: 'File Type', value: fileType || 'Document' },
          { label: 'Uploaded', value: new Date().toLocaleString('en-ZA') },
        ], 'View Files in Dashboard'),
      });

      return { statusCode: 200, body: JSON.stringify({ success: true, sentTo: notificationEmail }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown notification type' }) };

  } catch (error: any) {
    console.error('❌ Notification failed:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

// ─── EMAIL TEMPLATE HELPER ────────────────────────────────────────────────────
function buildEmail(
  brokerageName: string,
  title: string,
  color: string,
  rows: { label: string; value: string; badge?: boolean }[],
  ctaText: string
): string {
  const rowsHtml = rows.map(row => `
    <tr style="border-bottom: 1px solid #f3f4f6;">
      <td style="padding: 12px 0; font-size: 13px; color: #6b7280; width: 40%;">${row.label}</td>
      <td style="padding: 12px 0; font-size: 13px; font-weight: 600; color: #111827;">
        ${row.badge
          ? `<span style="background: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600;">${row.value}</span>`
          : row.value
        }
      </td>
    </tr>
  `).join('');

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: ${color}; border-radius: 8px 8px 0 0; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">${title}</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">${brokerageName}</p>
      </div>
      <div style="background: white; border-radius: 0 0 8px 8px; padding: 24px;">
        <table style="width: 100%; border-collapse: collapse;">${rowsHtml}</table>
        <div style="margin-top: 24px; text-align: center;">
          <a href="https://independi.claimsportal.co.za/broker-dashboard"
            style="background: ${color}; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
            ${ctaText} →
          </a>
        </div>
        <p style="margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px;">
          Automated notification from Claims Portal · ${brokerageName}
        </p>
      </div>
    </div>
  `;
}
