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
  console.log("create-team-member called", event.httpMethod);

  try {
    if (event.httpMethod === "OPTIONS") {
      console.log("OPTIONS preflight request");
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    }

    if (event.httpMethod !== "POST") {
      console.log("Invalid method:", event.httpMethod);
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    console.log("body", body);

    const { fullName, email, role, phoneNumber, idNumber, brokerageId } = body;

    if (!email || !role || !brokerageId) {
      console.error("Missing required fields:", { email: !!email, role: !!role, brokerageId: !!brokerageId });
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing required fields: email, role, or brokerageId" }),
      };
    }

    console.log("Creating auth user for email:", email);

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
    console.log("User created successfully:", userId);

    // 2) Upsert into profiles table
    console.log("Creating profile for user:", userId);
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
        body: JSON.stringify({ error: "Failed to create user profile: " + profileError.message }),
      };
    }

    console.log("Profile created successfully");

    // 3) Fetch brokerage details to get tenant subdomain/slug
    console.log("Fetching brokerage details for ID:", brokerageId);
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

    console.log("Brokerage found:", brokerageData);

    const tenant = brokerageData.subdomain || brokerageData.slug;

    if (!tenant) {
      console.error("Brokerage has no subdomain or slug:", brokerageData);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Brokerage has no subdomain or slug" }),
      };
    }

    console.log("Generating invite link for tenant:", tenant);

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
        body: JSON.stringify({ error: "Failed to generate invite link: " + (linkError?.message || "Unknown error") }),
      };
    }

    const inviteUrl = linkData.properties.action_link;
    console.log("Invite link generated successfully");

    // 5) Send email via Resend
    const from = process.env.RESEND_FROM_EMAIL!;
    const resendKey = process.env.RESEND_API_KEY!;

    console.log("Sending invitation email to:", email);

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
      console.error("Resend failed:", resendResp.status, text);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Failed to send invitation email: " + text }),
      };
    }

    const resendData = await resendResp.json();
    console.log("Email sent successfully:", resendData);

    console.log("Team member creation completed successfully for:", email);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, userId }),
    };
  } catch (err: any) {
    console.error("Unexpected error in create-team-member:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err?.message || String(err) }),
    };
  }
};
