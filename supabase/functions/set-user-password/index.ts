import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SetPasswordRequest {
  user_email: string;
  new_password: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user: callingUser },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !callingUser) {
      throw new Error("Unauthorized");
    }

    const { data: callingProfile, error: profileError } = await supabaseClient
      .from("broker_profiles")
      .select("role")
      .eq("id", callingUser.id)
      .maybeSingle();

    if (profileError || !callingProfile) {
      throw new Error("Profile not found");
    }

    if (callingProfile.role !== "super_admin") {
      throw new Error("Only super admins can set user passwords");
    }

    const { user_email, new_password }: SetPasswordRequest = await req.json();

    if (!user_email || !new_password) {
      throw new Error("Missing required fields: user_email, new_password");
    }

    if (new_password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const targetUser = users.find(u => u.email === user_email);
    if (!targetUser) {
      throw new Error(`User with email ${user_email} not found`);
    }

    console.log(`Setting password for user: ${user_email} (ID: ${targetUser.id})`);
    console.log(`User identities:`, targetUser.identities?.map(i => i.provider));

    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.id,
      {
        password: new_password,
        email_confirm: true,
      }
    );

    if (updateError) {
      throw new Error(`Failed to update user password: ${updateError.message}`);
    }

    console.log(`Password successfully set for user: ${user_email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Password successfully set for ${user_email}. User can now log in with email and password.`,
        user: {
          id: updatedUser.user.id,
          email: updatedUser.user.email,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error setting user password:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
