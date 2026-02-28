import { supabase } from "./supabase";

type AttachmentRef = {
  bucket: string;
  path: string;
  url?: string;
  kind?: string;
  label?: string;
};

export async function submitClaimUnified(params: {
  claimType: string;
  claimData: Record<string, any>;
  attachments?: AttachmentRef[];
}) {
  // 1. Get authenticated user
  const { data: authRes, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authRes?.user) {
    throw new Error("User not authenticated");
  }

  const uid = authRes.user.id;
  if (!uid) {
    throw new Error("User ID not available");
  }

  const user = authRes.user;

  // 2. Load profile (single source of truth)
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("user_id, role, brokerage_id, full_name, email, cell_number, policy_number")
    .eq("user_id", uid)
    .maybeSingle();

  if (profErr) throw profErr;
  if (!profile) throw new Error("Profile not found");

  // 3. Snapshot profile data (stored permanently with claim)
  const claimantSnapshot = {
    full_name: profile.full_name ?? null,
    email: profile.email ?? user.email ?? null,
    cell_number: profile.cell_number ?? null,
    policy_number: profile.policy_number ?? null,
    role: profile.role ?? null,
    brokerage_id: profile.brokerage_id ?? null,
  };

  // 4. Build unified payload
  const payload = {
    incident_type: params.claimType,
    client_id: uid,
    brokerage_id: profile.brokerage_id,
    status: "new",
    claimant_name: profile.full_name ?? null,
    claimant_email: profile.email ?? user.email ?? null,
    claimant_phone: profile.cell_number ?? null,
    policy_number: profile.policy_number ?? null,
    claimant_snapshot: claimantSnapshot,
    claim_data: params.claimData ?? {},
    attachments: params.attachments ?? [],
  };

  // 5. Insert claim
  const { data, error } = await supabase
    .from("claims")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;

  return data;
}
