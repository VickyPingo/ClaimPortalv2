export function getSubdomain(): string | null {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;

  // Development environment
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }

  // Extract subdomain from hostname
  const parts = hostname.split('.');

  // claims.independi.co.za -> subdomain is 'claims'
  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
}

export function isIndependiSubdomain(): boolean {
  const subdomain = getSubdomain();
  return subdomain === 'claims';
}

export function isSuperAdminDomain(): boolean {
  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname;

  // Super admin can only access from root domain or localhost
  return hostname === 'localhost' ||
         hostname === '127.0.0.1' ||
         hostname === 'independi.co.za' ||
         hostname.includes('bolt.new');
}

export function getOrganisationIdFromSubdomain(): string | null {
  // Map subdomains to organisation IDs
  const subdomain = getSubdomain();

  if (subdomain === 'claims') {
    // This should match the Independi organisation ID in the database
    return '00000000-0000-0000-0000-000000000001';
  }

  return null;
}
