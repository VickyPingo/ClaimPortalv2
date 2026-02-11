import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const getCookieDomain = () => {
  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return undefined;
  }

  if (hostname.includes('independi.co.za')) {
    return '.independi.co.za';
  }

  if (hostname.includes('claimsportal.co.za')) {
    return '.claimsportal.co.za';
  }

  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return `.${parts.slice(-2).join('.')}`;
  }

  return undefined;
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'supabase-auth',
    storage: window.localStorage,
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
    sameSite: 'Lax'
  }
});
