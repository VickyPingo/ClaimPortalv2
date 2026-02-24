import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: "",
      };
    }

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const { fullName, email, role, phoneNumber, idNumber, brokerageId } = JSON.parse(
      event.body || "{}"
    );

    if (!email || !role || !brokerageId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing required fields: email, role, or brokerageId" }),
      };
    }

    // 1) Create auth user without password
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    if (userError || !userData.user) {
      console.error("Failed to create user:", userError);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: userError?.message || "Failed to create user" }),
      };
    }

    const userId = userData.user.id;

    // 2) Upsert into profiles table
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      user_id: userId,
      role,
      brokerage_id: brokerageId,
      full_name: fullName || null,
      cell_number: phoneNumber || null,
      id_number: idNumber || null,
    });

    if (profileError) {
      console.error("Failed to create profile:", profileError);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Failed to create user profile" }),
      };
    }

    // 3) Fetch brokerage details to get tenant subdomain/slug
    const { data: brokerageData, error: brokerageError } = await supabaseAdmin
      .from("brokerages")
      .select("subdomain, slug")
      .eq("id", brokerageId)
      .maybeSingle();

    if (brokerageError || !brokerageData) {
      console.error("Failed to fetch brokerage:", brokerageError);
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

    // 4) Generate Supabase invite link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `https://${tenant}.claimsportal.co.za/set-password?brokerId=${brokerageId}`,
      },
    });

    if (linkError || !linkData) {
      console.error("Failed to generate invite link:", linkError);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Failed to generate invite link" }),
      };
    }

    const inviteUrl = linkData.properties.action_link;

    // 5) Send email via Resend
    const from = process.env.RESEND_FROM_EMAIL!;
    const resendKey = process.env.RESEND_API_KEY!;

    const subject = `You've been added to Claims Portal as ${role}`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5">
        <h2>Welcome to Claims Portal</h2>
        <p>You've been added as a team member with the role: <b>${role}</b>.</p>
        ${fullName ? `<p>Name: ${fullName}</p>` : ""}
        <p>Click the button below to set your password and get started:</p>
        <p>
          <a href="${inviteUrl}"
             style="display:inline-block;padding:10px 14px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
             Set Your Password
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
      console.error("Resend failed:", text);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Failed to send invitation email" }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, userId }),
    };
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err?.message || String(err) }),
    };
  }
};
