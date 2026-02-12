import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LinkIdentityRequest {
  email: string;
  password: string;
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

    const { email, password }: LinkIdentityRequest = await req.json();

    if (!email || !password) {
      throw new Error("Missing required fields: email, password");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    console.log(`Linking email identity for: ${email}`);

    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const targetUser = users.find(u => u.email === email);
    if (!targetUser) {
      throw new Error(`User with email ${email} not found`);
    }

    console.log(`User identities before:`, targetUser.identities?.map(i => i.provider));

    const hasEmailIdentity = targetUser.identities?.some(
      identity => identity.provider === 'email'
    );

    if (hasEmailIdentity) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "User already has email/password authentication enabled",
          already_linked: true,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.id,
      {
        password: password,
        email_confirm: true,
      }
    );

    if (updateError) {
      throw new Error(`Failed to link email identity: ${updateError.message}`);
    }

    console.log(`Email identity successfully linked for: ${email}`);
    console.log(`User identities after:`, updatedUser.user.identities?.map(i => i.provider));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email/password authentication successfully enabled for ${email}. You can now log in with your password.`,
        user: {
          id: updatedUser.user.id,
          email: updatedUser.user.email,
          identities: updatedUser.user.identities?.map(i => i.provider),
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
    console.error("Error linking email identity:", error);
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
