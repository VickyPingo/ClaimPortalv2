import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const handler: Handler = async (event) => {
  console.log("create-team-member called", event.httpMethod);

  // Handle CORS preflight
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

  try {
    const body = JSON.parse(event.body || "{}");
    console.log("body", body);

    const {
      fullName,
      email,
      role,
      phoneNumber,
      idNumber,
      brokerageId,
    } = body;

    if (!email || !brokerageId) {
      console.error("Missing required fields:", { email: !!email, brokerageId: !!brokerageId });
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing required fields: email and brokerageId" }),
      };
    }

    console.log("Creating Supabase client");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 0) Fetch brokerage subdomain for redirectTo URL
    console.log("Fetching brokerage subdomain for:", brokerageId);
    const { data: brokerageData, error: brokerageError } = await supabase
      .from("brokerages")
      .select("subdomain, slug")
      .eq("id", brokerageId)
      .maybeSingle();

    if (brokerageError) {
      console.error("Failed to fetch brokerage:", brokerageError);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Failed to fetch brokerage details" }),
      };
    }

    if (!brokerageData) {
      console.error("Brokerage not found:", brokerageId);
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Brokerage not found" }),
      };
    }

    const tenant = brokerageData.subdomain || brokerageData.slug;
    if (!tenant) {
      console.error("Brokerage has no subdomain or slug:", brokerageId);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Brokerage has no subdomain configured" }),
      };
    }

    console.log("Brokerage tenant subdomain:", tenant);

    // 1) Create invitation record
    console.log("Creating invitation for:", email);
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: inviteError } = await supabase
      .from("invitations")
      .insert({
        email,
        role: role || "broker",
        brokerage_id: brokerageId,
        token,
        expires_at: expiresAt,
        is_active: true,
        used_count: 0,
        max_uses: 1,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Invite creation failed:", inviteError);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: inviteError.message }),
      };
    }

    console.log("Invitation created successfully:", invite);

    // 2) Generate Supabase invite link with tenant-specific redirectTo
    const redirectTo = `https://${tenant}.claimsportal.co.za/set-password?token=${token}&brokerId=${brokerageId}`;
    console.log("Generating invite link with redirectTo:", redirectTo);

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
      },
    });

    if (linkError) {
      console.error("Failed to generate invite link:", linkError);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: linkError.message }),
      };
    }

    console.log("Invite link generated successfully");

    // 3) Auto-populate profiles table with organization_id (mapped from brokerage_id)
    if (linkData?.user) {
      console.log("Auto-populating profiles for user:", linkData.user.id);

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: linkData.user.id,
            organization_id: brokerageId,
            role: role || "broker",
            full_name: fullName || email,
            email: email,
            cell_number: phoneNumber || "",
            id_number: idNumber || "",
          },
          { onConflict: "id" }
        );

      if (profileError) {
        console.error("Failed to create profiles entry:", profileError);
      } else {
        console.log("profiles entry created successfully");
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        inviteUrl: linkData?.properties?.action_link,
        invitation: invite,
      }),
    };
  } catch (error: any) {
    console.error("Unexpected error in create-team-member:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || String(error) }),
    };
  }
};
