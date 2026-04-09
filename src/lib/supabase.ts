import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔌 Supabase Client Configuration:');
console.log('   URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING');
console.log('   Anon Key:', supabaseAnonKey ? 'Present' : 'MISSING');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const getCookieDomain = () => {
  const hostname = window.location.hostname;
  console.log('🍪 Cookie Domain Detection:');
  console.log('   Hostname:', hostname);

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('   Cookie Domain: undefined (localhost)');
    return undefined;
  }

  if (hostname.includes('independi.co.za')) {
    console.log('   Cookie Domain: .independi.co.za');
    return '.independi.co.za';
  }

  if (hostname.includes('claimsportal.co.za')) {
    console.log('   Cookie Domain: .claimsportal.co.za');
    return '.claimsportal.co.za';
  }

  const parts = hostname.split('.');
  if (parts.length >= 2) {
    const domain = `.${parts.slice(-2).join('.')}`;
    console.log('   Cookie Domain:', domain);
    return domain;
  }

  console.log('   Cookie Domain: undefined (fallback)');
  return undefined;
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'sb-independi-auth',
    storage: window.sessionStorage, // ✅ Changed from localStorage — session ends when tab is closed
    redirectTo: `${window.location.origin}/auth/callback`
  },
  global: {
    headers: {
      'x-client-info': 'supabase-js-web'
    }
  },
  cookieOptions: {
    domain: getCookieDomain(),
    path: '/',
    sameSite: 'Lax',
    secure: true
  }
});
