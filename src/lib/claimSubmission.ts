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
  claimantName?: string;
  claimantEmail?: string;
  claimantPhone?: string;
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
  // Priority: explicit params > claimData > profile > user metadata > fallback
  const finalClaimantName = params.claimantName ??
    params.claimData?.claimantName ??
    params.claimData?.name ??
    profile.full_name ??
    user.user_metadata?.full_name ??
    user.email ??
    "Anonymous";

  const finalClaimantEmail = params.claimantEmail ??
    params.claimData?.claimantEmail ??
    params.claimData?.email ??
    profile.email ??
    user.email ??
    null;

  const finalClaimantPhone = params.claimantPhone ??
    params.claimData?.claimantPhone ??
    params.claimData?.phone ??
    profile.cell_number ??
    user.user_metadata?.phone ??
    null;

  const claimantSnapshot = {
    full_name: finalClaimantName,
    email: finalClaimantEmail,
    cell_number: finalClaimantPhone,
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
    claimant_name: finalClaimantName,
    claimant_email: finalClaimantEmail,
    claimant_phone: finalClaimantPhone,
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
