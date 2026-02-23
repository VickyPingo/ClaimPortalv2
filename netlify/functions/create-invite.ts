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

    // Generate invite token + expiry
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // Save invite in DB
    const { error: insertErr } = await supabaseAdmin.from("invites").insert({
      email,
      role,
      brokerage_id: brokerageId,
      token,
      expires_at: expiresAt,
    });

    if (insertErr) throw insertErr;

    // Send Supabase invite email
    const baseUrl = process.env.APP_BASE_URL!;
    const redirectTo = `${baseUrl}/set-password?token=${token}`;

    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { role, invite_token: token },
    });

    if (inviteErr) throw inviteErr;

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || String(err) }),
    };
  }
};
