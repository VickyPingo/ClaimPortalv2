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
  // CORS preflight
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

    // Step 1: Detect tenant from the URL subdomain
    const host = getHost(event);
    const tenantSubdomain = getSubdomainFromHost(host);

    console.log('🌐 Host detection:', { host, tenantSubdomain });

    // Step 2: Find brokerage
    // Priority:
    // - If UI sent brokerageId, use it
    // - Else use tenantSubdomain (independi)
    let resolvedBrokerageId = brokerageIdFromUI as string | undefined;

    if (!resolvedBrokerageId) {
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

      resolvedBrokerageId = brokerage.id;
      console.log('✅ Brokerage resolved from subdomain:', resolvedBrokerageId);
    } else {
      console.log('✅ Brokerage ID provided:', resolvedBrokerageId);
    }

    // Step 3: Determine role (default to 'staff' if not provided, never 'client')
    const finalRole = role || 'staff';
    console.log('👤 Role assigned:', finalRole);

    // Step 4: Create invitation row
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    console.log('📝 Creating invitation with:', {
      email,
      role: finalRole,
      brokerage_id: resolvedBrokerageId,
      token,
      expires_at: expiresAt,
    });

    const { error: inviteErr } = await supabaseAdmin.from("invitations").insert({
      email,
      role: finalRole,
      brokerage_id: resolvedBrokerageId,
      token,
      expires_at: expiresAt,
      is_active: true,
      used_count: 0,
      max_uses: 1,
    });

    if (inviteErr) {
      console.error('❌ Failed to create invitation:', inviteErr);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: inviteErr.message }),
      };
    }

    console.log('✅ Invitation created successfully');

    // Step 5: Generate Supabase invite link (lets them SET THEIR OWN PASSWORD)
    // IMPORTANT:
    // We redirect to the TENANT URL (subdomain) so they stay in the right brokerage portal.
    const tenant = tenantSubdomain || "claimsportal"; // fallback

    const redirectTo = `https://${tenant}.claimsportal.co.za/set-password?token=${token}&brokerId=${resolvedBrokerageId}`;

    console.log('🔗 Generating invite link with redirect:', redirectTo);

    const { data: linkData, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo },
      });

    if (linkErr) {
      console.error('❌ Failed to generate invite link:', linkErr);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: linkErr.message }),
      };
    }

    const inviteUrl = linkData?.properties?.action_link;
    console.log('✅ Invite link generated');

    // Step 6: If Supabase created/returned the user, immediately UPSERT into profiles
    if (linkData?.user?.id) {
      console.log('👤 User exists/created, upserting profile for user:', linkData.user.id);

      const profileData = {
        user_id: linkData.user.id,
        brokerage_id: resolvedBrokerageId,
        role: finalRole,
        full_name: fullName || email,
      };

      console.log('📝 Profile data:', profileData);

      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .upsert(profileData, { onConflict: "user_id" });

      if (profileErr) {
        console.error('❌ Failed to upsert profile:', profileErr);
        // Don't fail the invitation if profile upsert fails
        // The SetPassword component will handle this
      } else {
        console.log('✅ Profile upserted successfully');
      }
    } else {
      console.log('ℹ️ No user returned from generateLink - profile will be created on password set');
    }

    // Step 7: Optional: send email via Resend (if env vars exist)
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    if (resendKey && from && inviteUrl) {
      console.log('📧 Sending invitation email to:', email);

      const subject = "You're invited to Claims Portal";
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5">
          <h2>You're invited</h2>
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
        console.warn('⚠️ Email send failed:', text);
        // Don't fail the invite if email fails — return link so you can still use it
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            emailSent: false,
            resendError: text,
            inviteUrl,
            token,
          }),
        };
      } else {
        console.log('✅ Invitation email sent successfully');
      }
    } else {
      console.log('ℹ️ Email not configured or no invite URL - skipping email send');
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        emailSent: !!(resendKey && from),
        inviteUrl,
        token,
      }),
    };
  } catch (err: any) {
    console.error('❌ Unexpected error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err?.message || String(err) }),
    };
  }
};
