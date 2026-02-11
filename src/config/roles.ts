export const SUPER_ADMINS = ['vickypingo@gmail.com'];

export function isSuperAdmin(email: string | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMINS.includes(email.toLowerCase());
}
