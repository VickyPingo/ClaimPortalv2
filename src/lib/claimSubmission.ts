import { supabase } from './supabase';

export interface ClaimantSnapshot {
  full_name: string;
  cell_number: string;
  email: string;
  id_number?: string;
  policy_number?: string;
  submission_timestamp: string;
}

export async function getClaimantSnapshot(userId: string): Promise<ClaimantSnapshot> {
  const { data: authRes } = await supabase.auth.getUser();
  const user = authRes.user;
  if (!user) throw new Error('Not authenticated');

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('user_id, brokerage_id, full_name, cell_number, email, policy_number')
    .eq('user_id', user.id)
    .single();

  if (profileErr || !profile) {
    console.error('Profile lookup failed for user:', user.id);
    throw new Error('Profile not found. Please complete your profile.');
  }

  return {
    full_name: profile.full_name || 'Unknown',
    cell_number: profile.cell_number || '',
    email: profile.email || '',
    policy_number: profile.policy_number || '',
    submission_timestamp: new Date().toISOString(),
  };
}

export function buildCompleteClaimData(formData: any): any {
  const claimData: any = {};

  Object.entries(formData).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value) && value.length === 0) return;
      if (typeof value === 'object' && Object.keys(value).length === 0) return;

      claimData[key] = value;
    }
  });

  return claimData;
}

export async function submitClaimWithSnapshot(
  userId: string,
  brokerageId: string,
  incidentType: string,
  claimFields: any
): Promise<{ success: boolean; claimId?: string; error?: any }> {
  try {
    const claimantSnapshot = await getClaimantSnapshot(userId);

    const completeClaimData = buildCompleteClaimData(claimFields);

    const claimRecord = {
      brokerage_id: brokerageId,
      user_id: userId,
      incident_type: incidentType,
      status: 'new',
      claimant_snapshot: claimantSnapshot,
      claim_data: completeClaimData,
      claimant_name: claimantSnapshot.full_name,
      claimant_phone: claimantSnapshot.cell_number,
      claimant_email: claimantSnapshot.email,
      ...claimFields,
    };

    const { data, error } = await supabase
      .from('claims')
      .insert(claimRecord)
      .select('id')
      .single();

    if (error) {
      return { success: false, error };
    }

    return { success: true, claimId: data.id };
  } catch (error) {
    return { success: false, error };
  }
}
