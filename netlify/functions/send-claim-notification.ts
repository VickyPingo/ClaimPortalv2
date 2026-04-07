import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { claimId } = JSON.parse(event.body || '{}');
    if (!claimId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'claimId required' }) };
    }

    // Fetch claim with brokerage info
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*, brokerages(name, notification_email)')
      .eq('id', claimId)
      .maybeSingle();

    if (claimError || !claim) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Claim not found' }) };
    }

    const brokerageName = claim.brokerages?.name || 'Your Brokerage';
    const notificationEmail = claim.brokerages?.notification_email;

    if (!notificationEmail) {
      console.warn('No notification email set for brokerage:', claim.brokerage_id);
      return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'No notification email' }) };
    }

    // Format incident type nicely
    const incidentLabel = (claim.incident_type || 'Unknown')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l: string) => l.toUpperCase());

    // Format submitted date
    const submittedDate = new Date(claim.created_at).toLocaleString('en-ZA', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const claimRef = claimId.substring(0, 8).toUpperCase();

    await resend.emails.send({
      from: 'Claims Portal <onboarding@resend.dev>',
      to: [notificationEmail],
      subject: `New Claim Submitted — ${incidentLabel} | Ref: ${claimRef}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">

          <div style="background: #1d4ed8; border-radius: 8px 8px 0 0; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">🛡️ New Claim Submitted</h1>
            <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">${brokerageName}</p>
          </div>

          <div style="background: white; border-radius: 0 0 8px 8px; padding: 24px;">

            <div style="background: #eff6ff; border-left: 4px solid #1d4ed8; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 13px; color: #1e40af; font-weight: bold;">CLAIM REFERENCE</p>
              <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: bold; color: #1e3a8a;">${claimRef}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 12px 0; font-size: 13px; color: #6b7280; width: 40%;">Claim Type</td>
                <td style="padding: 12px 0; font-size: 13px; font-weight: 600; color: #111827;">${incidentLabel}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 12px 0; font-size: 13px; color: #6b7280;">Claimant</td>
                <td style="padding: 12px 0; font-size: 13px; font-weight: 600; color: #111827;">${claim.claimant_name || 'Unknown'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 12px 0; font-size: 13px; color: #6b7280;">Email</td>
                <td style="padding: 12px 0; font-size: 13px; color: #111827;">${claim.claimant_email || 'Not provided'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 12px 0; font-size: 13px; color: #6b7280;">Phone</td>
                <td style="padding: 12px 0; font-size: 13px; color: #111827;">${claim.claimant_phone || 'Not provided'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 12px 0; font-size: 13px; color: #6b7280;">Submitted</td>
                <td style="padding: 12px 0; font-size: 13px; color: #111827;">${submittedDate}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-size: 13px; color: #6b7280;">Status</td>
                <td style="padding: 12px 0;">
                  <span style="background: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600;">NEW</span>
                </td>
              </tr>
            </table>

            <div style="margin-top: 24px; text-align: center;">
              <a href="https://independi.claimsportal.co.za/broker-dashboard"
                style="background: #1d4ed8; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
                View Claim in Dashboard →
              </a>
            </div>

            <p style="margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px;">
              This is an automated notification from Claims Portal.<br/>
              You are receiving this because you are registered as a broker for ${brokerageName}.
            </p>
          </div>
        </div>
      `,
    });

    console.log('✅ Claim notification sent to:', notificationEmail);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, sentTo: notificationEmail }),
    };
  } catch (error: any) {
    console.error('❌ Notification email failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
