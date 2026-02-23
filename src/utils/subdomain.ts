export function getSubdomain(): string | null {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;

  // Development environment
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }

  // For full custom domains like claims.independi.co.za, return the full domain
  // For subdomains like independi.claimsportal.co.za, return just the subdomain part
  const parts = hostname.split('.');

  // Check if it's a subdomain of claimsportal.co.za
  if (hostname.endsWith('.claimsportal.co.za') && parts.length >= 4) {
    return parts[0];
  }

  // For full custom domains, return the entire hostname
  if (parts.length >= 2) {
    return hostname;
  }

  return null;
}

export function isIndependiSubdomain(): boolean {
  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname;

  // Check if it's claims.independi.co.za (full custom domain)
  if (hostname === 'claims.independi.co.za') {
    return true;
  }

  // Or if it's using the old subdomain pattern
  const subdomain = getSubdomain();
  return subdomain === 'independi' || subdomain === 'claims';
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

export function getBrokerageSlug(): string | null {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname.toLowerCase();

  // Pattern: independi.claimsportal.co.za -> "independi"
  if (hostname.endsWith('.claimsportal.co.za')) {
    const parts = hostname.split('.');
    return parts[0] || null;
  }

  // Custom domain mapping examples:
  // claims.independi.co.za -> "independi"
  if (hostname === 'claims.independi.co.za') return 'independi';

  // Add more custom domains here as you onboard them:
  // if (hostname === 'claims.somebroker.co.za') return 'somebroker';

  return null;
}
