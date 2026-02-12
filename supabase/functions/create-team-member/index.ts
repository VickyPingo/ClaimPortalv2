import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateTeamMemberRequest {
  email: string;
  full_name: string;
  role: "broker" | "staff";
  phone_number?: string;
  id_number?: string;
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
      .from("profiles")
      .select("brokerage_id, role")
      .eq("id", callingUser.id)
      .maybeSingle();

    if (profileError || !callingProfile) {
      throw new Error("Profile not found");
    }

    if (callingProfile.role !== "broker" && callingProfile.role !== "super_admin") {
      throw new Error("Only brokers can create team members");
    }

    const { email, full_name, role, phone_number, id_number }: CreateTeamMemberRequest = await req.json();

    if (!email || !full_name || !role) {
      throw new Error("Missing required fields: email, full_name, role");
    }

    if (role !== "broker" && role !== "staff") {
      throw new Error("Role must be either 'broker' or 'staff'");
    }

    const { data: existingUser, error: checkError } = await supabaseAdmin.auth.admin.listUsers();
    if (checkError) {
      throw new Error(`Failed to check existing users: ${checkError.message}`);
    }

    const userExists = existingUser.users.some(u => u.email === email);
    if (userExists) {
      throw new Error("A user with this email already exists");
    }

    const temporaryPassword = `Temp${Math.random().toString(36).slice(-8)}!`;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    });

    if (createError || !newUser.user) {
      throw new Error(`Failed to create user: ${createError?.message || "Unknown error"}`);
    }

    const { error: profileInsertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newUser.user.id,
        brokerage_id: callingProfile.brokerage_id,
        full_name,
        role,
        user_type: "broker",
        phone_number: phone_number || "",
        id_number: id_number || "",
      });

    if (profileInsertError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw new Error(`Failed to create profile: ${profileInsertError.message}`);
    }

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError) {
      console.warn("Failed to send invitation email:", inviteError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          full_name,
          role,
          brokerage_id: callingProfile.brokerage_id,
        },
        message: "Team member created successfully. An invitation email has been sent.",
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
    console.error("Error creating team member:", error);
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
