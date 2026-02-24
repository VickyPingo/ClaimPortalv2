import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
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

    // 1) Create invitation record
    console.log("Creating invitation for:", email);
    const { data: invite, error: inviteError } = await supabase
      .from("invitations")
      .insert({
        email,
        role,
        brokerage_id: brokerageId,
        max_uses: 1,
        used_count: 0,
        is_active: true,
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

    // 2) Generate Supabase invite link
    console.log("Generating invite link for:", email);
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `${process.env.SITE_URL || 'https://claimsportal.co.za'}/set-password?token=${invite.token}&brokerId=${brokerageId}`,
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

    // 3) Auto-populate broker_profiles with brokerage_id
    if (linkData?.user) {
      console.log("Auto-populating broker_profiles for:", linkData.user.id);

      const { error: profileError } = await supabase
        .from("broker_profiles")
        .upsert(
          {
            id: linkData.user.id,
            brokerage_id: brokerageId,
            role: role || "staff",
            full_name: fullName || email,
            cell_number: phoneNumber || "",
            id_number: idNumber || "",
          },
          { onConflict: "id" }
        );

      if (profileError) {
        console.error("Failed to create broker_profiles entry:", profileError);
      } else {
        console.log("broker_profiles entry created successfully");
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
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
