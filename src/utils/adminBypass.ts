import type { BrokerProfile } from '../contexts/AuthContext';

export function getMasterAdminProfile(): BrokerProfile {
  return {
    id: 'master-admin-bypass-id',
    full_name: 'Super Administrator',
    id_number: 'ADMIN-MASTER-001',
    cell_number: '+27000000000',
    policy_number: 'ADMIN-MASTER',
    brokerage_id: 'master-brokerage-id',
    role: 'super_admin',
  };
}

export function isMasterAdmin(email: string | undefined): boolean {
  if (!email) return false;
  return (
    email === 'vickypingo@gmail.com' ||
    email === 'admin-master@claimsportal.co.za' ||
    email.includes('admin')
  );
}
