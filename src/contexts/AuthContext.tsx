import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useBrokerage } from './BrokerageContext';
import { SUPER_ADMINS, isSuperAdmin } from '../config/roles';
import { isIndependiSubdomain, getBrokerageSlug, getSubdomain } from '../utils/subdomain';

export interface BrokerProfile {
  id: string;
  full_name: string;
  id_number: string;
  cell_number: string;
  policy_number?: string;
  brokerage_id: string;
  role?: string;
}

export interface ClientProfile {
  id: string;
  full_name: string;
  email: string;
  cell_number: string;
  brokerage_id: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  userType: 'broker' | 'client' | null;
  userRole: string | null;
  brokerageId: string | null;
  brokerProfile: BrokerProfile | null;
  clientProfile: ClientProfile | null;
  loading: boolean;
  needsPasswordSetup: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  brokerSignUp: (email: string, password: string, profile: Omit<BrokerProfile, 'id' | 'brokerage_id'> & { brokerage_id?: string }) => Promise<User>;
  brokerSignIn: (email: string, password: string) => Promise<void>;
  clientSignUp: (email: string, password: string, profile: Omit<ClientProfile, 'id' | 'brokerage_id'>) => Promise<User>;
  clientSignIn: (email: string, password: string) => Promise<void>;
  completePasswordSetup: () => Promise<void>;
  isSuperAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { brokerage } = useBrokerage();
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<'broker' | 'client' | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [brokerageId, setBrokerageId] = useState<string | null>(null);
  const [brokerProfile, setBrokerProfile] = useState<BrokerProfile | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🚀 AuthContext initialising');

    const detectInviteFlow = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);
      const hasAccessToken = hashParams.has('access_token');
      const hasType = hashParams.has('type') || queryParams.has('type');
      const type = hashParams.get('type') || queryParams.get('type');
      const isInviteOrRecovery = type === 'recovery' || type === 'invite' || type === 'magiclink';
      console.log('🔍 Checking for invite/recovery flow:', { hasAccessToken, hasType, type, isInviteOrRecovery });
      return hasAccessToken || isInviteOrRecovery;
    };

    const isInviteFlow = detectInviteFlow();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        console.log('📦 Session found');
        setUser(session.user);
        const userIsSuperAdmin = isSuperAdmin(session.user.email);
        if (isInviteFlow && !userIsSuperAdmin) {
          console.log('🔐 Invite/Recovery flow detected on init - showing password setup');
          setNeedsPasswordSetup(true);
          setLoading(false);
        } else {
          if (userIsSuperAdmin && isInviteFlow) {
            console.log('👑 Super admin detected - bypassing password setup');
          }
          loadUserProfile(session.user.id, session.user.email);
        }
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user ? 'with user' : 'no user');

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserType(null);
        setUserRole(null);
        setBrokerageId(null);
        setBrokerProfile(null);
        setClientProfile(null);
        setNeedsPasswordSetup(false);
        setError(null);
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        console.log('🔐 PASSWORD_RECOVERY event detected');
        if (session?.user) {
          setUser(session.user);
          const userIsSuperAdmin = isSuperAdmin(session.user.email);
          if (!userIsSuperAdmin) {
            setNeedsPasswordSetup(true);
            setLoading(false);
          } else {
            console.log('👑 Super admin detected - bypassing password recovery setup');
            loadUserProfile(session.user.id, session.user.email);
          }
        }
        return;
      }

      if (event === 'SIGNED_IN') {
        console.log('✅ SIGNED_IN event detected');
        if (session?.user) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const queryParams = new URLSearchParams(window.location.search);
          const hasAccessToken = hashParams.has('access_token');
          const type = hashParams.get('type') || queryParams.get('type');
          const isInviteFlow = hasAccessToken || type === 'recovery' || type === 'invite' || type === 'magiclink';
          const userIsSuperAdmin = isSuperAdmin(session.user.email);

          if (isInviteFlow && !userIsSuperAdmin) {
            console.log('🔐 SIGNED_IN via invite/recovery link - showing password setup');
            setUser(session.user);
            setNeedsPasswordSetup(true);
            setLoading(false);
            return;
          } else if (isInviteFlow && userIsSuperAdmin) {
            console.log('👑 Super admin SIGNED_IN via invite - bypassing password setup');
            setUser(session.user);
            loadUserProfile(session.user.id, session.user.email);
            return;
          }
        }
      }

      if (session?.user) {
        setUser(session.user);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);
        const hasAccessToken = hashParams.has('access_token');
        const type = hashParams.get('type') || queryParams.get('type');
        const isInviteFlow = hasAccessToken || type === 'recovery' || type === 'invite' || type === 'magiclink';
        const userIsSuperAdmin = isSuperAdmin(session.user.email);

        if (isInviteFlow && !userIsSuperAdmin) {
          console.log('🔐 Invite flow detected via hash/params - showing password setup');
          setNeedsPasswordSetup(true);
          setLoading(false);
        } else {
          if (userIsSuperAdmin && isInviteFlow) {
            console.log('👑 Super admin invite flow detected - bypassing password setup');
          }
          loadUserProfile(session.user.id, session.user.email);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string, userEmail: string | undefined) => {
    try {
      // ─── FIX: Always reset loading=true at the start of profile loading.
      // This prevents HomePageRouter from attempting to route while the
      // profile is still being fetched — which caused the broker-portal
      // redirect bug on fresh sign-in (loading was already false from
      // the initial getSession that found no session).
      setLoading(true);

      console.log('Loading profile for userId:', userId);

      const { data: { user } } = await supabase.auth.getUser();

      // CRITICAL: Force super_admin role for vickypingo@gmail.com
      if (userEmail === 'vickypingo@gmail.com') {
        console.log('👑 SUPER ADMIN OVERRIDE: vickypingo@gmail.com detected');
        setUserType('broker');
        setUserRole('super_admin');
        setBrokerageId(null);
        setLoading(false);

        const { data: profileCheck } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (profileCheck) {
          setBrokerProfile(profileCheck);
          if (profileCheck.role !== 'super_admin') {
            await supabase.from('profiles').update({ role: 'super_admin' }).eq('user_id', userId);
          }
        }
        return;
      }

      const isUserSuperAdmin = isSuperAdmin(userEmail);

      let { data: brokerProfileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (brokerProfileData) {
        // Patch incomplete profiles (preserve role — not included in updatePayload)
        if (!brokerProfileData.brokerage_id || !brokerProfileData.email || !brokerProfileData.full_name) {
          console.log('📝 Profile incomplete - patching with subdomain brokerage data');
          const subdomain = getSubdomain();
          if (subdomain) {
            const { data: brokerage, error: brokerageError } = await supabase
              .from('brokerages')
              .select('id')
              .or(`subdomain.eq.${subdomain},slug.eq.${subdomain}`)
              .maybeSingle();

            if (!brokerageError && brokerage) {
              const updatePayload = {
                brokerage_id: brokerage.id,
                email: userEmail || user?.email || '',
                full_name: user?.user_metadata?.full_name || brokerProfileData?.full_name || '',
                is_active: true,
              };

              const { error: updateErr } = await supabase
                .from('profiles')
                .update(updatePayload)
                .eq('user_id', userId);

              if (!updateErr) {
                const { data: updatedProfile } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('user_id', userId)
                  .single();
                if (updatedProfile) brokerProfileData = updatedProfile;
              } else {
                console.error('❌ PROFILE UPDATE FAILED:', updateErr);
              }
            } else {
              console.warn('⚠️ No brokerage found for subdomain:', subdomain);
            }
          }
        }

        // Check deactivated
        if (brokerProfileData.is_active === false) {
          console.log('🚫 User account is deactivated');
          await supabase.auth.signOut();
          setUser(null); setUserType(null); setUserRole(null);
          setBrokerageId(null); setBrokerProfile(null); setClientProfile(null);
          setError('Your account has been deactivated. Please contact your broker administrator.');
          setLoading(false);
          return;
        }

        const brokerageId = brokerProfileData.brokerage_id;
        const profileWithBrokerageId = brokerProfileData;

        console.log('Profile found, role:', profileWithBrokerageId.role, 'brokerage_id:', brokerageId);

        // Promote to super_admin if email is in SUPER_ADMINS list
        if (isUserSuperAdmin && brokerProfileData.role !== 'super_admin') {
          await supabase.from('profiles').update({ role: 'super_admin' }).eq('user_id', userId);
          profileWithBrokerageId.role = 'super_admin';
        }

        // ── SUPER ADMIN ──────────────────────────────────────────────
        if (profileWithBrokerageId.role === 'super_admin') {
          console.log('👑 SUPER ADMIN DETECTED');
          setUserType('broker');
          setUserRole('super_admin');
          setBrokerageId(null);
          setBrokerProfile(profileWithBrokerageId);
          setLoading(false);

          const currentHostname = window.location.hostname;
          const isOnSubdomain = currentHostname.endsWith('.claimsportal.co.za') && currentHostname !== 'claimsportal.co.za';
          if (isOnSubdomain && currentHostname !== 'localhost' && currentHostname !== '127.0.0.1') {
            console.log('🚀 SUPER ADMIN REDIRECT to root domain');
            window.location.href = `https://claimsportal.co.za/dashboard/admin`;
          }
          return;
        }

        // ── BROKER / MAIN BROKER ─────────────────────────────────────
        if (profileWithBrokerageId.role === 'broker' || profileWithBrokerageId.role === 'main_broker') {
          console.log('✓ Broker profile found');
          setUserType('broker');
          setUserRole(profileWithBrokerageId.role);
          setBrokerageId(brokerageId);
          setBrokerProfile(profileWithBrokerageId);
          setLoading(false);

          if (brokerageId) {
            const { data: brokerageData, error: brokerageError } = await supabase
              .from('brokerages')
              .select('subdomain, slug')
              .eq('id', brokerageId)
              .maybeSingle();

            if (!brokerageError && brokerageData) {
              const brokerageSubdomain = brokerageData.subdomain || brokerageData.slug;
              if (brokerageSubdomain) {
                const currentHostname = window.location.hostname;
                const expectedHostname = `${brokerageSubdomain}.claimsportal.co.za`;
                if (currentHostname !== 'localhost' && currentHostname !== '127.0.0.1' && currentHostname !== expectedHostname) {
                  console.log('🚀 BROKER SUBDOMAIN REDIRECT:', expectedHostname);
                  window.location.href = `https://${expectedHostname}/dashboard/broker`;
                  return;
                }
              }
            }
          }
          return;
        }

        // ── CLIENT (in profiles table) ───────────────────────────────
        if (profileWithBrokerageId.role === 'client') {
          console.log('✓ Client profile found in profiles table');
          setUserType('client');
          setUserRole('client');
          setBrokerageId(brokerageId);
          setClientProfile({
            id: profileWithBrokerageId.id,
            full_name: profileWithBrokerageId.full_name || '',
            email: profileWithBrokerageId.email || '',
            cell_number: profileWithBrokerageId.cell_number || '',
            brokerage_id: brokerageId,
            role: 'client',
          });
          setLoading(false);
          return;
        }

        // Unrecognised role — preserve whatever is in DB but default type to broker
        console.warn('⚠️ Unrecognised role:', profileWithBrokerageId.role);
        setUserType('broker');
        setUserRole(profileWithBrokerageId.role || 'broker');
        setBrokerageId(brokerageId);
        setBrokerProfile(profileWithBrokerageId);
        setLoading(false);
        return;
      }

      // ── CLIENT (in legacy client_profiles table) ─────────────────
      const { data: clientProfileData } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!clientProfileData) {
        console.error('Profile lookup failed for user:', userId);
      }

      if (clientProfileData) {
        if (clientProfileData.is_active === false) {
          console.log('🚫 Client account is deactivated');
          await supabase.auth.signOut();
          setUser(null); setUserType(null); setUserRole(null);
          setBrokerageId(null); setBrokerProfile(null); setClientProfile(null);
          setError('Your account has been deactivated. Please contact your broker administrator.');
          setLoading(false);
          return;
        }

        console.log('✓ Client profile found in client_profiles table');
        setUserType('client');
        setBrokerageId(clientProfileData.brokerage_id);
        setClientProfile(clientProfileData);
        setUserRole(clientProfileData.role || 'client');
        setLoading(false);
        return;
      }

      console.warn('No profile found for user:', userId);
      setLoading(false);
    } catch (error) {
      console.error('Error loading profile:', error);
      setLoading(false);
    }
  };

  const signOut = async () => {
    console.log('🚪 Signing out');
    await supabase.auth.signOut();
    setUser(null); setUserType(null); setUserRole(null);
    setBrokerageId(null); setBrokerProfile(null); setClientProfile(null);
    setError(null);
  };

  const completePasswordSetup = async () => {
    console.log('✅ Completing password setup flow');
    setNeedsPasswordSetup(false);
    if (user) {
      console.log('🔄 Reloading user profile after password setup');
      await loadUserProfile(user.id, user.email);
    }
  };

  const isSuperAdminFunc = (): boolean => {
    if (isSuperAdmin(user?.email)) return true;
    return userRole === 'super_admin';
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔐 Signing in:', email);
    const { data: { session: existingSession } } = await supabase.auth.getSession();
    if (existingSession && existingSession.user?.email !== email) {
      localStorage.clear();
      await supabase.auth.signOut();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const response = await supabase.auth.signInWithPassword({ email, password });
      if (!response) { await supabase.auth.signOut(); throw new Error('Authentication service error'); }

      const { data, error } = response;

      if (error) {
        await supabase.auth.signOut();
        if (error.message.includes('Invalid login credentials')) {
          try {
            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-email-identity`;
            const linkResult = await (await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json();
            if (linkResult.success) {
              const retry = await supabase.auth.signInWithPassword({ email, password });
              if (retry.error || !retry.data?.user) throw new Error('Login failed after linking identity.');
              setUser(retry.data.user);
              await loadUserProfile(retry.data.user.id, retry.data.user.email);
              return;
            } else { throw new Error(linkResult.error || 'Failed to enable password login'); }
          } catch { throw new Error('Invalid email or password.'); }
        }
        throw error;
      }

      if (!data?.user) { await supabase.auth.signOut(); throw new Error('Sign in failed - no user data returned'); }
      console.log('✓ Password login successful');
      setUser(data.user);
      await loadUserProfile(data.user.id, data.user.email);
    } catch (error) { await supabase.auth.signOut(); throw error; }
  };

  const brokerSignUp = async (
    email: string,
    password: string,
    profile: Omit<BrokerProfile, 'id' | 'brokerage_id'> & { brokerage_id?: string }
  ) => {
    console.log('🔵 BROKER SIGNUP:', email);
    const { data: existingInvite } = await supabase.from('invitations').select('role, brokerage_id, is_active').eq('email', email).eq('is_active', true).maybeSingle();
    if (existingInvite) throw new Error('You have a pending invitation. Please check your email and use the invitation link to set up your account.');

    let assignedRole = 'broker';
    if (email === 'vickypingo@gmail.com') { assignedRole = 'super_admin'; }
    else if (isIndependiSubdomain()) { assignedRole = 'broker'; }

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    const brokerageId = profile.brokerage_id;
    if (!brokerageId) throw new Error('No brokerage found for this account.');

    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id, user_id: authData.user.id, brokerage_id: brokerageId,
      full_name: profile.full_name || email, email, id_number: profile.id_number || '',
      cell_number: profile.cell_number || '', policy_number: profile.policy_number || null, role: assignedRole,
    });
    if (profileError) throw new Error(`Failed to create profile: ${profileError.message}`);
    return authData.user;
  };

  const brokerSignIn = async (email: string, password: string) => {
    console.log('🔐 Broker signing in:', email);
    const { data: { session: existingSession } } = await supabase.auth.getSession();
    if (existingSession && existingSession.user?.email !== email) {
      localStorage.clear(); await supabase.auth.signOut(); await new Promise(r => setTimeout(r, 100));
    }
    try {
      const response = await supabase.auth.signInWithPassword({ email, password });
      if (!response) { await supabase.auth.signOut(); throw new Error('Authentication service error'); }
      const { data, error } = response;
      if (error) {
        await supabase.auth.signOut();
        if (error.message.includes('Invalid login credentials')) {
          try {
            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-email-identity`;
            const linkResult = await (await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json();
            if (linkResult.success) {
              const retry = await supabase.auth.signInWithPassword({ email, password });
              if (retry.error || !retry.data?.user) throw new Error('Login failed after linking identity.');
              setUser(retry.data.user); await loadUserProfile(retry.data.user.id, retry.data.user.email); return;
            } else { throw new Error(linkResult.error || 'Failed to enable password login'); }
          } catch { throw new Error('Invalid email or password.'); }
        }
        throw error;
      }
      if (!data?.user) { await supabase.auth.signOut(); throw new Error('Sign in failed - no user data returned'); }
      console.log('✓ Broker login successful');
      setUser(data.user); await loadUserProfile(data.user.id, data.user.email);
    } catch (error) { await supabase.auth.signOut(); throw error; }
  };

  const clientSignUp = async (email: string, password: string, profile: Omit<ClientProfile, 'id' | 'brokerage_id'>) => {
    console.log('🔵 CLIENT SIGNUP:', email);
    const brokerageSlug = getBrokerageSlug();
    if (!brokerageSlug) throw new Error('Please sign up from your brokerage link (e.g. independi.claimsportal.co.za).');

    const { data: existingInvite } = await supabase.from('invitations').select('role, brokerage_id, is_active').eq('email', email).eq('is_active', true).maybeSingle();
    if (existingInvite) throw new Error('You have a pending invitation. Please check your email and use the invitation link to set up your account.');

    const { data: brokerageData, error: brokerageError } = await supabase.from('brokerages').select('id').or(`subdomain.eq.${brokerageSlug},slug.eq.${brokerageSlug}`).maybeSingle();
    if (brokerageError || !brokerageData) throw new Error('Could not find brokerage for this domain. Please contact your broker.');

    const brokerageId = brokerageData.id;
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: profile.full_name, cell_number: profile.cell_number, role: 'client' } } });
    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    const { error: profileError } = await supabase.from('profiles').upsert({
      user_id: authData.user.id, brokerage_id: brokerageId, full_name: profile.full_name,
      email, cell_number: profile.cell_number || '', role: 'client', is_active: true,
    }, { onConflict: 'user_id' });
    if (profileError) throw new Error(`Failed to create profile: ${profileError.message}`);

    console.log('✅ Client profile created');
    return authData.user;
  };

  const clientSignIn = async (email: string, password: string) => {
    console.log('🔐 Client signing in:', email);
    const { data: { session: existingSession } } = await supabase.auth.getSession();
    if (existingSession && existingSession.user?.email !== email) {
      localStorage.clear(); await supabase.auth.signOut(); await new Promise(r => setTimeout(r, 100));
    }
    try {
      const response = await supabase.auth.signInWithPassword({ email, password });
      if (!response) { await supabase.auth.signOut(); throw new Error('Authentication service error'); }
      const { data, error } = response;
      if (error) {
        await supabase.auth.signOut();
        if (error.message.includes('Invalid login credentials')) {
          try {
            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-email-identity`;
            const linkResult = await (await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json();
            if (linkResult.success) {
              const retry = await supabase.auth.signInWithPassword({ email, password });
              if (retry.error || !retry.data?.user) throw new Error('Login failed after linking identity.');
              setUser(retry.data.user); await loadUserProfile(retry.data.user.id, retry.data.user.email); return;
            } else { throw new Error(linkResult.error || 'Failed to enable password login'); }
          } catch { throw new Error('Invalid email or password.'); }
        }
        throw error;
      }
      if (!data?.user) { await supabase.auth.signOut(); throw new Error('Sign in failed - no user data returned'); }
      console.log('✓ Client login successful');
      setUser(data.user); await loadUserProfile(data.user.id, data.user.email);
    } catch (error) { await supabase.auth.signOut(); throw error; }
  };

  return (
    <AuthContext.Provider value={{
      user, userType, userRole, brokerageId, brokerProfile, clientProfile,
      loading, needsPasswordSetup, error, signOut, signIn, brokerSignUp,
      brokerSignIn, clientSignUp, clientSignIn, completePasswordSetup, isSuperAdmin: isSuperAdminFunc,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
