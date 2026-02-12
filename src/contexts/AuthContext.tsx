import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useBrokerage } from './BrokerageContext';
import { SUPER_ADMINS, isSuperAdmin } from '../config/roles';
import { isIndependiSubdomain } from '../utils/subdomain';

// BROKERAGE ID FOR CLAIMS.INDEPENDI.CO.ZA
const INDEPENDI_BROKERAGE_ID = 'f67b67c8-086b-4b42-8d27-917a0783e9b0';

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
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  brokerSignUp: (email: string, password: string, profile: Omit<BrokerProfile, 'id' | 'brokerage_id'> & { brokerage_id?: string }) => Promise<User>;
  brokerSignIn: (email: string, password: string) => Promise<void>;
  clientSignUp: (email: string, password: string, profile: Omit<ClientProfile, 'id' | 'brokerage_id'>, brokerageId?: string) => Promise<User>;
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

  useEffect(() => {
    console.log('🚀 AuthContext initialising');

    const detectInviteFlow = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);

      const hasAccessToken = hashParams.has('access_token');
      const hasType = hashParams.has('type') || queryParams.has('type');
      const type = hashParams.get('type') || queryParams.get('type');

      const isInviteOrRecovery = type === 'recovery' || type === 'invite' || type === 'magiclink';

      console.log('🔍 Checking for invite/recovery flow:', {
        hasAccessToken,
        hasType,
        type,
        isInviteOrRecovery,
        hash: window.location.hash,
        search: window.location.search
      });

      return hasAccessToken || isInviteOrRecovery;
    };

    const isInviteFlow = detectInviteFlow();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        console.log('📦 Session found');
        setUser(session.user);

        // CRITICAL: Super admins bypass password setup entirely
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
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        console.log('🔐 PASSWORD_RECOVERY event detected - user from invite link');
        if (session?.user) {
          setUser(session.user);

          // CRITICAL: Super admins bypass password setup
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

          // CRITICAL: Super admins bypass password setup
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

        // CRITICAL: Super admins bypass password setup
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
      console.log('🔍 Loading profile for user:', userId);

      // CRITICAL: Force super_admin role for vickypingo@gmail.com regardless of database
      if (userEmail === 'vickypingo@gmail.com') {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('👑 SUPER ADMIN OVERRIDE: vickypingo@gmail.com detected');
        console.log('✅ FORCING super_admin ROLE - BYPASSING DATABASE CHECK');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        setUserType('broker');
        setUserRole('super_admin');
        setBrokerageId(null);
        setLoading(false);

        // Update database in background
        const { data: profileCheck } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (profileCheck) {
          setBrokerProfile(profileCheck);
          if (profileCheck.role !== 'super_admin') {
            await supabase
              .from('profiles')
              .update({ role: 'super_admin', user_type: 'super_admin' })
              .eq('id', userId);
          }
        }
        return;
      }

      // Check if user is super admin by email
      const isUserSuperAdmin = isSuperAdmin(userEmail);

      // Try to load broker profile first
      const { data: brokerProfileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .eq('role', 'broker')
        .maybeSingle();

      if (brokerProfileData) {
        console.log('✓ Broker profile found');
        console.log('  Role:', brokerProfileData.role);
        console.log('  Brokerage ID:', brokerProfileData.brokerage_id);

        // Force super_admin role if email is in SUPER_ADMINS list
        if (isUserSuperAdmin && brokerProfileData.role !== 'super_admin') {
          await supabase
            .from('profiles')
            .update({ role: 'super_admin' })
            .eq('id', userId);
          brokerProfileData.role = 'super_admin';
        }

        setUserType('broker');
        setUserRole(brokerProfileData.role || 'broker');

        // SUPER ADMIN NEUTRALITY: Super admins see ALL data regardless of brokerage_id
        // Even if brokerage_id is NULL, they have full system access
        if (brokerProfileData.role === 'super_admin') {
          console.log('  ⭐ SUPER ADMIN: Full system access granted');
          setBrokerageId(null);
        } else {
          // Regular brokers are restricted to their brokerage
          console.log('  🔒 BROKER: Restricted to brokerage_id:', brokerProfileData.brokerage_id);
          setBrokerageId(brokerProfileData.brokerage_id);
        }

        setBrokerProfile(brokerProfileData);

        // INDEPENDI BROKER PRIORITY: Immediate redirect for independi.co.za brokers
        const independiBrokers = ['dietrich@independi.co.za', 'vicky@independi.co.za'];
        if (independiBrokers.includes(userEmail || '')) {
          console.log('🎯 INDEPENDI BROKER LOGIN DETECTED - Immediate redirect to broker dashboard');
          console.log('   Broker:', userEmail);
          const targetUrl = 'https://claimsportal.co.za/dashboard/broker';
          if (window.location.href !== targetUrl) {
            console.log('   Forcing redirect to:', targetUrl);
            window.location.href = targetUrl;
          }
          return;
        }

        // EMERGENCY REDIRECT: Force brokers to claimsportal.co.za broker dashboard
        if (brokerProfileData.role === 'broker' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          const targetUrl = 'https://claimsportal.co.za/dashboard/broker';
          if (window.location.href !== targetUrl) {
            console.log('🚨 EMERGENCY REDIRECT: Broker login detected, forcing redirect to:', targetUrl);
            setTimeout(() => {
              window.location.href = targetUrl;
            }, 500);
          }
        }

        return;
      }

      // Try to load client profile
      const { data: clientProfileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .eq('role', 'client')
        .maybeSingle();

      if (clientProfileData) {
        console.log('✓ Client profile found');
        setUserType('client');
        setBrokerageId(clientProfileData.brokerage_id);
        setClientProfile(clientProfileData);
        setUserRole(clientProfileData.role || 'client');
        return;
      }

      console.warn('⚠️ No profile found');
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const signOut = async () => {
    console.log('🚪 Signing out');
    await supabase.auth.signOut();

    setUser(null);
    setUserType(null);
    setUserRole(null);
    setBrokerageId(null);
    setBrokerProfile(null);
    setClientProfile(null);
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
    console.log('🔐 Signing in with password');
    console.log('   Email:', email);
    console.log('   Clearing any existing session first...');

    // CRITICAL: Clear localStorage to remove any cached data
    console.log('🧹 Clearing localStorage to remove cached session data');
    localStorage.clear();

    // CRITICAL: Clear any existing session before attempting login
    await supabase.auth.signOut();
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // CRITICAL: ONLY use signInWithPassword - NO OAuth or social providers
      // This prevents "Auth session missing" and OAuth-related errors
      const response = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Check if response exists before destructuring
      if (!response) {
        console.error('❌ No response from auth service');
        await supabase.auth.signOut();
        throw new Error('Authentication service error');
      }

      const { data, error } = response;

      if (error) {
        console.error('❌ Password login failed:', error.message);

        // SESSION RESET: Immediately sign out to prevent session conflicts
        console.log('🧹 Clearing session after failed login attempt');
        await supabase.auth.signOut();

        // Handle OAuth conflict by linking email identity
        if (error.message.includes('Invalid login credentials')) {
          console.log('🔗 Attempting to link email identity for OAuth user...');

          try {
            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-email-identity`;
            const linkResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email, password }),
            });

            const linkResult = await linkResponse.json();

            if (linkResult.success) {
              console.log('✓ Email identity linked successfully, retrying login...');

              // Retry login after linking identity
              const retryResponse = await supabase.auth.signInWithPassword({
                email,
                password,
              });

              if (retryResponse.error) {
                throw new Error('Login failed after linking identity. Please try again.');
              }

              if (!retryResponse.data || !retryResponse.data.user) {
                throw new Error('Sign in failed - no user data returned');
              }

              console.log('✓ Password login successful after identity linking');
              setUser(retryResponse.data.user);
              await loadUserProfile(retryResponse.data.user.id, retryResponse.data.user.email);
              return;
            } else {
              throw new Error(linkResult.error || 'Failed to enable password login');
            }
          } catch (linkError) {
            console.error('❌ Identity linking failed:', linkError);
            throw new Error('Invalid email or password. If this account uses OAuth, please contact your administrator to set up password login.');
          }
        }

        throw error;
      }

      if (!data || !data.user) {
        await supabase.auth.signOut();
        throw new Error('Sign in failed - no user data returned');
      }

      console.log('✓ Password login successful');
      setUser(data.user);
      await loadUserProfile(data.user.id, data.user.email);
    } catch (error) {
      // Ensure session is cleared on any error
      await supabase.auth.signOut();
      throw error;
    }
  };

  const brokerSignUp = async (
    email: string,
    password: string,
    profile: Omit<BrokerProfile, 'id' | 'brokerage_id'> & { brokerage_id?: string }
  ) => {
    console.log('🔵 BROKER SIGNUP - Manual profile creation');
    console.log('   Email:', email);
    console.log('   Is Independi Subdomain:', isIndependiSubdomain());

    // CRITICAL: Determine role based on email and subdomain
    let assignedRole = 'broker';

    // Only vickypingo@gmail.com can be super_admin
    if (email === 'vickypingo@gmail.com') {
      assignedRole = 'super_admin';
      console.log('   ⭐ Super Admin signup detected');
    } else if (isIndependiSubdomain()) {
      // FORCE broker role for Independi subdomain
      assignedRole = 'broker';
      console.log('   🔒 Independi subdomain: forcing broker role');
    }

    console.log('   Assigned Role:', assignedRole);

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    console.log('✅ Auth user created:', authData.user.id);

    // MANUAL PROFILE CREATION
    const brokerageId = profile.brokerage_id || INDEPENDI_BROKERAGE_ID;

    // Insert into profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        brokerage_id: brokerageId,
        full_name: profile.full_name || email,
        email: email,
        id_number: profile.id_number || '',
        cell_number: profile.cell_number || '',
        policy_number: profile.policy_number || null,
        role: assignedRole,
      });

    if (profileError) {
      console.error('❌ Failed to create profile:', profileError);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    console.log('✅ Profile created with role:', assignedRole);
    return authData.user;
  };

  const brokerSignIn = async (email: string, password: string) => {
    console.log('🔐 Broker signing in with password');
    console.log('   Email:', email);
    console.log('   Clearing any existing session first...');

    // CRITICAL: Clear localStorage to remove any cached data
    console.log('🧹 Clearing localStorage to remove cached session data');
    localStorage.clear();

    // CRITICAL: Clear any existing session before attempting login
    await supabase.auth.signOut();
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // ALWAYS use signInWithPassword for email/password auth
      const response = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Check if response exists before destructuring
      if (!response) {
        console.error('❌ No response from auth service');
        await supabase.auth.signOut();
        throw new Error('Authentication service error');
      }

      const { data, error } = response;

      if (error) {
        console.error('❌ Password login failed:', error.message);

        // SESSION RESET: Immediately sign out to prevent session conflicts
        console.log('🧹 Clearing session after failed login attempt');
        await supabase.auth.signOut();

        // Handle OAuth conflict by linking email identity
        if (error.message.includes('Invalid login credentials')) {
          console.log('🔗 Attempting to link email identity for OAuth user...');

          try {
            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-email-identity`;
            const linkResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email, password }),
            });

            const linkResult = await linkResponse.json();

            if (linkResult.success) {
              console.log('✓ Email identity linked successfully, retrying login...');

              // Retry login after linking identity
              const retryResponse = await supabase.auth.signInWithPassword({
                email,
                password,
              });

              if (retryResponse.error) {
                throw new Error('Login failed after linking identity. Please try again.');
              }

              if (!retryResponse.data || !retryResponse.data.user) {
                throw new Error('Sign in failed - no user data returned');
              }

              console.log('✓ Broker password login successful after identity linking');
              setUser(retryResponse.data.user);
              await loadUserProfile(retryResponse.data.user.id, retryResponse.data.user.email);
              return;
            } else {
              throw new Error(linkResult.error || 'Failed to enable password login');
            }
          } catch (linkError) {
            console.error('❌ Identity linking failed:', linkError);
            throw new Error('Invalid email or password. If this account uses OAuth, please contact your administrator to set up password login.');
          }
        }

        throw error;
      }

      if (!data || !data.user) {
        await supabase.auth.signOut();
        throw new Error('Sign in failed - no user data returned');
      }

      console.log('✓ Broker password login successful');
      setUser(data.user);
      await loadUserProfile(data.user.id, data.user.email);
    } catch (error) {
      // Ensure session is cleared on any error
      await supabase.auth.signOut();
      throw error;
    }
  };

  const clientSignUp = async (
    email: string,
    password: string,
    profile: Omit<ClientProfile, 'id' | 'brokerage_id'>,
    brokerageId?: string
  ) => {
    console.log('🔵 CLIENT SIGNUP - Manual profile creation');

    const currentBrokerageId = brokerageId || brokerage?.id;

    if (!currentBrokerageId) {
      throw new Error('Brokerage not loaded. Please refresh the page.');
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    console.log('✅ Auth user created:', authData.user.id);

    // MANUAL PROFILE CREATION
    const { error: profileError } = await supabase
      .from('client_profiles')
      .insert({
        id: authData.user.id,
        full_name: profile.full_name,
        email: profile.email,
        cell_number: profile.cell_number,
        brokerage_id: currentBrokerageId,
        role: 'client',
        user_type: 'client',
      });

    if (profileError) {
      console.error('❌ Failed to create client profile:', profileError);
      throw new Error(`Failed to create client profile: ${profileError.message}`);
    }

    console.log('✅ Client profile created successfully');
    return authData.user;
  };

  const clientSignIn = async (email: string, password: string) => {
    console.log('🔐 Client signing in with password');
    console.log('   Email:', email);
    console.log('   Clearing any existing session first...');

    // CRITICAL: Clear localStorage to remove any cached data
    console.log('🧹 Clearing localStorage to remove cached session data');
    localStorage.clear();

    // CRITICAL: Clear any existing session before attempting login
    await supabase.auth.signOut();
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // ALWAYS use signInWithPassword for email/password auth
      const response = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Check if response exists before destructuring
      if (!response) {
        console.error('❌ No response from auth service');
        await supabase.auth.signOut();
        throw new Error('Authentication service error');
      }

      const { data, error } = response;

      if (error) {
        console.error('❌ Password login failed:', error.message);

        // SESSION RESET: Immediately sign out to prevent session conflicts
        console.log('🧹 Clearing session after failed login attempt');
        await supabase.auth.signOut();

        // Handle OAuth conflict by linking email identity
        if (error.message.includes('Invalid login credentials')) {
          console.log('🔗 Attempting to link email identity for OAuth user...');

          try {
            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-email-identity`;
            const linkResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email, password }),
            });

            const linkResult = await linkResponse.json();

            if (linkResult.success) {
              console.log('✓ Email identity linked successfully, retrying login...');

              // Retry login after linking identity
              const retryResponse = await supabase.auth.signInWithPassword({
                email,
                password,
              });

              if (retryResponse.error) {
                throw new Error('Login failed after linking identity. Please try again.');
              }

              if (!retryResponse.data || !retryResponse.data.user) {
                throw new Error('Sign in failed - no user data returned');
              }

              console.log('✓ Client password login successful after identity linking');
              setUser(retryResponse.data.user);
              await loadUserProfile(retryResponse.data.user.id, retryResponse.data.user.email);
              return;
            } else {
              throw new Error(linkResult.error || 'Failed to enable password login');
            }
          } catch (linkError) {
            console.error('❌ Identity linking failed:', linkError);
            throw new Error('Invalid email or password. If this account uses OAuth, please contact your administrator to set up password login.');
          }
        }

        throw error;
      }

      if (!data || !data.user) {
        await supabase.auth.signOut();
        throw new Error('Sign in failed - no user data returned');
      }

      console.log('✓ Client password login successful');
      setUser(data.user);
      await loadUserProfile(data.user.id, data.user.email);
    } catch (error) {
      // Ensure session is cleared on any error
      await supabase.auth.signOut();
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userType,
        userRole,
        brokerageId,
        brokerProfile,
        clientProfile,
        loading,
        needsPasswordSetup,
        signOut,
        signIn,
        brokerSignUp,
        brokerSignIn,
        clientSignUp,
        clientSignIn,
        completePasswordSetup,
        isSuperAdmin: isSuperAdminFunc,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
