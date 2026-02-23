import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    const { email, role, brokerageId } = JSON.parse(event.body || "{}");

    if (!email || !role || !brokerageId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing email, role, or brokerageId" }),
      };
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1) Create invitation row
    const { error: dbErr } = await supabaseAdmin.from("invitations").insert({
      email,
      role,
      brokerage_id: brokerageId,
      token,
      expires_at: expiresAt,
      is_active: true,
      used_count: 0,
      max_uses: 1,
    });

    if (dbErr) throw dbErr;

    // 2) Send email via Resend
    const from = process.env.RESEND_FROM_EMAIL!;
    const resendKey = process.env.RESEND_API_KEY!;
    const baseUrl = process.env.APP_BASE_URL!;

    const inviteUrl = `${baseUrl}/set-password?token=${token}`;

    const subject =
      role === "main_broker"
        ? "You're invited as Main Broker"
        : "You're invited as Broker";

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5">
        <h2>You're invited</h2>
        <p>You’ve been invited to Claims Portal as <b>${role}</b>.</p>
        <p>Click the button below to set your password and get started:</p>
        <p>
          <a href="${inviteUrl}"
             style="display:inline-block;padding:10px 14px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
             Accept Invite
          </a>
        </p>
        <p>If the button doesn’t work, copy/paste this link:</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      </div>
    `;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject,
        html,
      }),
    });

    if (!resendResp.ok) {
      const text = await resendResp.text();
      throw new Error(`Resend failed: ${text}`);
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || String(err) }),
    };
  }
};
