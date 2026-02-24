import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getHost(event: any) {
  return (
    event.headers?.["x-forwarded-host"] ||
    event.headers?.["host"] ||
    event.headers?.["Host"] ||
    ""
  );
}

function getSubdomainFromHost(host: string) {
  // host examples:
  // - independi.claimsportal.co.za
  // - claimsportal.co.za
  // - localhost:5173
  if (!host) return null;

  const clean = host.split(":")[0].toLowerCase();

  if (clean === "localhost" || clean === "127.0.0.1") return null;

  // If it's a tenant subdomain of claimsportal.co.za
  if (clean.endsWith(".claimsportal.co.za")) {
    const parts = clean.split(".");
    // independi.claimsportal.co.za => ["independi","claimsportal","co","za"]
    if (parts.length >= 4) return parts[0];
  }

  return null;
}

export const handler: Handler = async (event) => {
  // ✅ CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "ok",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const {
      fullName,
      email,
      role, // "broker" | "staff" | "main_broker" etc.
      phoneNumber,
      idNumber,
      // NOTE: brokerageId can still be sent, but we no longer REQUIRE it
      brokerageId: brokerageIdFromUI,
    } = body;

    if (!email) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing required field: email" }),
      };
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ✅ 1) Detect tenant from the URL subdomain
    const host = getHost(event);
    const tenantSubdomain = getSubdomainFromHost(host);

    // ✅ 2) Find brokerage
    // Priority:
    // - If UI sent brokerageId, use it
    // - Else use tenantSubdomain (independi)
    let brokerageId = brokerageIdFromUI as string | undefined;

    if (!brokerageId) {
      if (!tenantSubdomain) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            error:
              "No brokerageId provided and no tenant subdomain found. You must invite from a tenant URL like independi.claimsportal.co.za",
            debug: { host },
          }),
        };
      }

      const { data: brokerage, error: brokerageErr } = await supabaseAdmin
        .from("brokerages")
        .select("id, subdomain, slug, signup_code")
        .or(
          `subdomain.eq.${tenantSubdomain},slug.eq.${tenantSubdomain},signup_code.eq.${tenantSubdomain}`
        )
        .maybeSingle();

      if (brokerageErr || !brokerage?.id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "Could not find brokerage for this subdomain",
            debug: { host, tenantSubdomain, brokerageErr },
          }),
        };
      }

      brokerageId = brokerage.id;
    }

    // ✅ 3) Create invitation row
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: inviteErr } = await supabaseAdmin.from("invitations").insert({
      email,
      role: role || "broker",
      brokerage_id: brokerageId,
      token,
      expires_at: expiresAt,
      is_active: true,
      used_count: 0,
      max_uses: 1,
    });

    if (inviteErr) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: inviteErr.message }),
      };
    }

    // ✅ 4) Generate Supabase invite link (lets them SET THEIR OWN PASSWORD)
    // IMPORTANT:
    // We redirect to the TENANT URL (subdomain) so they stay in the right brokerage portal.
    const tenant = tenantSubdomain || "claimsportal"; // fallback

    const redirectTo = `https://${tenant}.claimsportal.co.za/set-password?token=${token}&brokerId=${brokerageId}`;

    const { data: linkData, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo },
      });

    if (linkErr) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: linkErr.message }),
      };
    }

    const inviteUrl = linkData?.properties?.action_link;

    // ✅ 5) CRITICAL: Upsert broker profile so your app finds brokerage_id immediately
    // NOTE: Your DB uses user_id as the primary key (from your screenshot), not "id"
    if (linkData?.user?.id) {
      await supabaseAdmin.from("profiles").upsert(
        {
          user_id: linkData.user.id,
          brokerage_id: brokerageId,
          role: role || "broker",
          full_name: fullName || email,
          cell_number: phoneNumber || "",
          id_number: idNumber || "",
        },
        { onConflict: "user_id" }
      );
    }

    // ✅ 6) Optional: send email via Resend (if env vars exist)
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    if (resendKey && from && inviteUrl) {
      const subject = "You're invited to Claims Portal";
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5">
          <h2>You’re invited</h2>
          <p>Click below to set your password and get started:</p>
          <p>
            <a href="${inviteUrl}"
              style="display:inline-block;padding:10px 14px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
              Accept Invite & Set Password
            </a>
          </p>
          <p style="color:#666;font-size:12px;">This link expires in 7 days.</p>
        </div>
      `;

      const resp = await fetch("https://api.resend.com/emails", {
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

      if (!resp.ok) {
        const text = await resp.text();
        // Don’t fail the invite if email fails — return link so you can still use it
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            emailSent: false,
            resendError: text,
            inviteUrl,
          }),
        };
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        emailSent: !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
        inviteUrl,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err?.message || String(err) }),
    };
  }
};