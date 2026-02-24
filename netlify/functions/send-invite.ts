import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const handler: Handler = async (event) => {

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: "Method not allowed",
      };
    }

    const { email, role, brokerageId } = JSON.parse(event.body || "{}");

    if (!email || !role || !brokerageId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing email, role, or brokerageId" }),
      };
    }

    // Fetch brokerage details to get tenant subdomain
    const { data: brokerageData, error: brokerageError } = await supabaseAdmin
      .from("brokerages")
      .select("subdomain, slug")
      .eq("id", brokerageId)
      .maybeSingle();

    if (brokerageError || !brokerageData) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid brokerage ID" }),
      };
    }

    const tenant = brokerageData.subdomain || brokerageData.slug;

    if (!tenant) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Brokerage has no subdomain or slug" }),
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

    // 2) Generate Supabase invite link
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo: `https://${tenant}.claimsportal.co.za/set-password?token=${token}&brokerId=${brokerageId}`,
        },
      });

    if (linkError) {
      console.error("Generate invite link failed:", linkError);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: linkError.message }),
      };
    }

    const inviteUrl = linkData.properties.action_link;

    // CRITICAL: If user was just created, upsert profiles with organization_id
    if (linkData.user) {
      console.log("Auto-populating profiles for invited user:", linkData.user.id);

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: linkData.user.id,
            organization_id: brokerageId,
            role: role,
            full_name: email,
            email: email,
            id_number: "",
            cell_number: "",
          },
          { onConflict: "id" }
        );

      if (profileError) {
        console.error("Failed to create profiles entry:", profileError);
      } else {
        console.log("profiles entry created successfully");
      }
    }

    // 3) Send email via Resend
    const from = process.env.RESEND_FROM_EMAIL!;
    const resendKey = process.env.RESEND_API_KEY!;

    const subject =
      role === "main_broker"
        ? "You're invited as Main Broker"
        : "You're invited as Broker";

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5">
        <h2>You're invited</h2>
        <p>You've been invited to Claims Portal as <b>${role}</b>.</p>
        <p>Click the button below to set your password and get started:</p>
        <p>
          <a href="${inviteUrl}"
             style="display:inline-block;padding:10px 14px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
             Accept Invite & Set Password
          </a>
        </p>
        <p>If the button doesn't work, copy/paste this link:</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
        <p style="color:#666;font-size:12px;margin-top:20px;">This invitation link will expire in 7 days.</p>
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

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, inviteUrl })
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err?.message || String(err) }),
    };
  }
};
