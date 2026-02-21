import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  email: string;
  brokerageId: string;
  role: "broker_admin" | "broker"; // only these two for invited agents
  redirectTo?: string; // optional
};

export const handler: Handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceRoleKey) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing Supabase env vars" }),
      };
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = JSON.parse(event.body || "{}") as Body;

    if (!body.email || !body.brokerageId || !body.role) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "email, brokerageId, role are required" }),
      };
    }

    if (body.role !== "broker_admin" && body.role !== "broker") {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "role must be broker_admin or broker" }),
      };
    }

    // 1) Invite the user (this creates the auth user)
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(body.email, {
        redirectTo: body.redirectTo, // optional
        data: {
          brokerage_id: body.brokerageId, // becomes user_metadata
        },
      });

    if (inviteError) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: inviteError.message }),
      };
    }

    const userId = inviteData.user?.id;
    if (!userId) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invite succeeded but no user id returned" }),
      };
    }

    // 2) IMPORTANT: Set app_metadata.role (this is what you asked for)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        app_metadata: { role: body.role },
        user_metadata: { brokerage_id: body.brokerageId },
      }
    );

    if (updateError) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: updateError.message }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        userId,
        invitedEmail: body.email,
        role: body.role,
        brokerageId: body.brokerageId,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err?.message || "Unknown error" }),
    };
  }
};
