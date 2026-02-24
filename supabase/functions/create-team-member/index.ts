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
      .select("organization_id, role")
      .eq("id", callingUser.id)
      .maybeSingle();

    if (profileError || !callingProfile) {
      console.error("Profile lookup failed:", profileError);
      throw new Error("Profile not found");
    }

    console.log("Calling user profile:", { id: callingUser.id, role: callingProfile.role, organization_id: callingProfile.organization_id });

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

    console.log("Generating invite link for:", email);

    const { data: linkData, error: generateError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: {
          full_name,
        },
      },
    });

    if (generateError || !linkData) {
      console.error("Failed to generate invite link:", generateError);
      throw new Error(`Failed to generate invite link: ${generateError?.message || "Unknown error"}`);
    }

    console.log("Invite link generated successfully. User ID:", linkData.user?.id);

    if (linkData?.user) {
      const profileData = {
        id: linkData.user.id,
        organization_id: callingProfile.organization_id,
        role: role ?? "broker",
        full_name: full_name ?? email,
      };

      console.log("Upserting profile with data:", profileData);

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(profileData, { onConflict: "id" });

      if (profileError) {
        console.error("Failed to upsert profile:", profileError);
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }

      console.log("Profile upserted successfully for user:", linkData.user.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: linkData.user.id,
          email: linkData.user.email,
          full_name,
          role,
          organization_id: callingProfile.organization_id,
        },
        inviteLink: linkData.properties.action_link,
        message: "Team member created successfully. An invitation link has been generated.",
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
