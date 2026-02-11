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
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  brokerSignUp: (email: string, password: string, profile: Omit<BrokerProfile, 'id' | 'brokerage_id'> & { brokerage_id?: string }) => Promise<User>;
  brokerSignIn: (email: string, password: string) => Promise<void>;
  clientSignUp: (email: string, password: string, profile: Omit<ClientProfile, 'id' | 'brokerage_id'>, brokerageId?: string) => Promise<User>;
  clientSignIn: (email: string, password: string) => Promise<void>;
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

  useEffect(() => {
    console.log('🚀 AuthContext initialising');

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        console.log('📦 Session found');
        setUser(session.user);
        loadUserProfile(session.user.id, session.user.email);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state changed:', event);

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserType(null);
        setUserRole(null);
        setBrokerageId(null);
        setBrokerProfile(null);
        setClientProfile(null);
        return;
      }

      if (session?.user) {
        setUser(session.user);
        loadUserProfile(session.user.id, session.user.email);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string, userEmail: string | undefined) => {
    try {
      console.log('🔍 Loading profile for user:', userId);

      // Check if user is super admin by email
      const isUserSuperAdmin = isSuperAdmin(userEmail);

      // Try to load broker profile first
      const { data: brokerProfileData } = await supabase
        .from('broker_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (brokerProfileData) {
        console.log('✓ Broker profile found');
        console.log('  Role:', brokerProfileData.role);
        console.log('  Brokerage ID:', brokerProfileData.brokerage_id);

        // Force super_admin role if email is in SUPER_ADMINS list
        if (isUserSuperAdmin && brokerProfileData.role !== 'super_admin') {
          await supabase
            .from('broker_profiles')
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
        return;
      }

      // Try to load client profile
      const { data: clientProfileData } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('id', userId)
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

  const isSuperAdminFunc = (): boolean => {
    if (isSuperAdmin(user?.email)) return true;
    return userRole === 'super_admin';
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔐 Signing in with password');

    try {
      // ALWAYS use signInWithPassword for email/password auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Password login failed:', error.message);

        // SESSION RESET: Immediately sign out to prevent session conflicts
        console.log('🧹 Clearing session after failed login attempt');
        await supabase.auth.signOut();

        // PROVIDER CHECK: Check if user exists but with different auth method
        const { data: { user: existingUser } } = await supabase.auth.admin.getUserByEmail?.(email).catch(() => ({ data: { user: null } }));

        if (existingUser) {
          console.log('⚠️ User exists but password login failed');
          console.log('   User auth providers:', existingUser.app_metadata?.providers || 'unknown');

          // Check if user only has OAuth and no email provider
          const identities = existingUser.identities || [];
          const hasEmailProvider = identities.some(identity => identity.provider === 'email');

          if (!hasEmailProvider && identities.length > 0) {
            throw new Error('This account uses OAuth login. Please contact your administrator to set up password login.');
          }
        }

        throw error;
      }

      if (!data.user) {
        await supabase.auth.signOut();
        throw new Error('Sign in failed');
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

    // Insert into broker_profiles
    const { error: profileError } = await supabase
      .from('broker_profiles')
      .insert({
        id: authData.user.id,
        full_name: profile.full_name || email,
        id_number: profile.id_number || '',
        cell_number: profile.cell_number || '',
        policy_number: profile.policy_number || null,
        brokerage_id: brokerageId,
        role: assignedRole,
        user_type: assignedRole === 'super_admin' ? 'super_admin' : 'broker',
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

    try {
      // ALWAYS use signInWithPassword for email/password auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Password login failed:', error.message);

        // SESSION RESET: Immediately sign out to prevent session conflicts
        console.log('🧹 Clearing session after failed login attempt');
        await supabase.auth.signOut();

        // PROVIDER CHECK: Check if user exists but with different auth method
        const { data: { user: existingUser } } = await supabase.auth.admin.getUserByEmail?.(email).catch(() => ({ data: { user: null } }));

        if (existingUser) {
          console.log('⚠️ User exists but password login failed');
          console.log('   User auth providers:', existingUser.app_metadata?.providers || 'unknown');

          // Check if user only has OAuth and no email provider
          const identities = existingUser.identities || [];
          const hasEmailProvider = identities.some(identity => identity.provider === 'email');

          if (!hasEmailProvider && identities.length > 0) {
            throw new Error('This account uses OAuth login. Please contact your administrator to set up password login.');
          }
        }

        throw error;
      }

      if (!data.user) {
        await supabase.auth.signOut();
        throw new Error('Sign in failed');
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

    try {
      // ALWAYS use signInWithPassword for email/password auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Password login failed:', error.message);

        // SESSION RESET: Immediately sign out to prevent session conflicts
        console.log('🧹 Clearing session after failed login attempt');
        await supabase.auth.signOut();

        throw error;
      }

      if (!data.user) {
        await supabase.auth.signOut();
        throw new Error('Sign in failed');
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
        signOut,
        signIn,
        brokerSignUp,
        brokerSignIn,
        clientSignUp,
        clientSignIn,
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
