import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useBrokerage } from './BrokerageContext';
import { SUPER_ADMINS, isSuperAdmin } from '../config/roles';

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
    console.log('🚀 AuthContext initializing - fetching session from storage');

    const hangTimeout = setTimeout(() => {
      console.log('⏰ Session loading timeout - forcing loading state to false');
      setLoading(false);
    }, 2000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(hangTimeout);
      if (session?.user) {
        console.log('📦 Session found, setting user immediately');
        setUser(session.user);

        // IMMEDIATE: Set loading to false to unblock UI
        setLoading(false);

        // BACKGROUND: Fetch profile data without blocking
        (async () => {
          await determineUserType(session.user.id);
        })();
      } else {
        console.log('❌ No session found');
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.id);

      if (event === 'SIGNED_OUT') {
        console.log('🚪 User signed out - clearing state');
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

        // BACKGROUND: Fetch profile data without blocking UI
        (async () => {
          console.log('🔄 Refreshing profile from database');
          await determineUserType(session.user.id);
        })();
      }
    });

    return () => {
      clearTimeout(hangTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const determineUserType = async (userId: string) => {
    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 DETERMINING USER TYPE FOR USER ID:', userId);
      console.log('⚠️ NO CACHE - FETCHING FRESH FROM DATABASE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Get current user's email for role guard check
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userEmail = currentUser?.email;
      console.log('📧 User email:', userEmail);

      // ROLE GUARD: Check if email is in SUPER_ADMINS list
      const isUserSuperAdmin = isSuperAdmin(userEmail);
      if (isUserSuperAdmin) {
        console.log('🛡️ ROLE GUARD ACTIVATED: Email found in SUPER_ADMINS list');
        console.log('📋 Super Admins List:', SUPER_ADMINS);
      }

      const { data: brokerUser, error: brokerError } = await supabase
        .from('broker_users')
        .select('brokerage_id')
        .eq('id', userId)
        .maybeSingle();

      if (brokerError) console.error('Error fetching broker user:', brokerError);

      if (brokerUser) {
        console.log('✓ User is a broker, fetching profile...');

        const { data: profile, error: profileError } = await supabase
          .from('broker_profiles')
          .select('role, user_type, *')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) console.error('Error fetching broker profile:', profileError);

        setUserType('broker');
        setBrokerageId(brokerUser.brokerage_id);

        if (profile) {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📦 RAW DATABASE RESPONSE:');
          console.log('   Full profile object:', JSON.stringify(profile, null, 2));
          console.log('   profile.role =', profile.role);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          // DATABASE SYNCHRONIZATION: If user is super admin but DB doesn't reflect it, update DB
          if (isUserSuperAdmin && profile.role !== 'super_admin') {
            console.log('🔄 DATABASE SYNC: Updating profile in database to super_admin');
            const { error: updateError } = await supabase
              .from('broker_profiles')
              .update({ role: 'super_admin', user_type: 'broker' })
              .eq('id', userId);

            if (updateError) {
              console.error('❌ Error updating profile to super_admin:', updateError);
            } else {
              console.log('✅ Successfully synced super_admin role to database');
              profile.role = 'super_admin';
            }
          }

          // ROLE GUARD: Force super_admin if email is in SUPER_ADMINS list
          if (isUserSuperAdmin) {
            profile.role = 'super_admin';
            console.log('🔒 ROLE GUARD APPLIED: Role forced to super_admin');
          }

          setBrokerProfile(profile);
          setUserRole(profile.role || null);

          console.log('✓ Broker profile loaded and state updated');
          console.log('📋 Final Role Value:', profile.role);
          console.log('👑 Is Super Admin (computed):', profile.role === 'super_admin');
        } else {
          console.warn('⚠️ No broker profile found, creating default profile...');

          // CREATE DEFAULT PROFILE
          const defaultProfile: BrokerProfile = {
            id: userId,
            full_name: userEmail || 'User',
            id_number: '',
            cell_number: '',
            brokerage_id: brokerUser.brokerage_id,
            role: isUserSuperAdmin ? 'super_admin' : 'broker',
          };

          const { error: insertError } = await supabase
            .from('broker_profiles')
            .upsert(defaultProfile, { onConflict: 'id' });

          if (insertError) {
            console.error('❌ Error creating default broker profile:', insertError);
          } else {
            console.log('✅ Created default broker profile');
            setBrokerProfile(defaultProfile);
            setUserRole(defaultProfile.role || null);
          }
        }
        return;
      }

      const { data: clientProfile, error: clientError } = await supabase
        .from('client_profiles')
        .select('role, user_type, *')
        .eq('id', userId)
        .maybeSingle();

      if (clientError) console.error('Error fetching client profile:', clientError);

      if (clientProfile) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📦 RAW DATABASE RESPONSE (CLIENT):');
        console.log('   Full profile object:', JSON.stringify(clientProfile, null, 2));
        console.log('   clientProfile.role =', clientProfile.role);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        setUserType('client');
        setBrokerageId(clientProfile.brokerage_id);
        setClientProfile(clientProfile);
        setUserRole(clientProfile.role || null);

        console.log('✓ Client profile loaded and state updated');
        return;
      }

      console.warn('⚠️ No profile found for user, creating default broker profile...');

      // CREATE DEFAULT BROKER_USER AND PROFILE
      const defaultBrokerageId = brokerage?.id || 'f67b67c8-086b-4b42-8d27-917a0783e9b0';

      // Create broker_users entry
      const { error: brokerUserError } = await supabase
        .from('broker_users')
        .upsert({ id: userId, brokerage_id: defaultBrokerageId }, { onConflict: 'id' });

      if (brokerUserError) {
        console.error('❌ Error creating broker_users entry:', brokerUserError);
      }

      // Create broker_profiles entry
      const defaultProfile: BrokerProfile = {
        id: userId,
        full_name: userEmail || 'User',
        id_number: '',
        cell_number: '',
        brokerage_id: defaultBrokerageId,
        role: isUserSuperAdmin ? 'super_admin' : 'broker',
      };

      const { error: profileError } = await supabase
        .from('broker_profiles')
        .upsert(defaultProfile, { onConflict: 'id' });

      if (profileError) {
        console.error('❌ Error creating default broker profile:', profileError);
      } else {
        console.log('✅ Created default broker profile');
        setUserType('broker');
        setBrokerageId(defaultBrokerageId);
        setBrokerProfile(defaultProfile);
        setUserRole(defaultProfile.role || null);
      }
    } catch (error) {
      console.error('❌ Error determining user type:', error);

      // FALLBACK: On any error, check email
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (isSuperAdmin(currentUser?.email)) {
        console.log('🛡️ FALLBACK ACTIVATED: Error occurred but email is super admin - forcing super_admin');
        setUserType('broker');
        setUserRole('super_admin');
      }
    }
  };

  const signOut = async () => {
    console.log('🚪 Signing out and clearing all cached data...');

    // Clear ALL browser storage - use window.localStorage explicitly
    window.localStorage.clear();
    window.sessionStorage.clear();
    console.log('🧹 Cleared localStorage and sessionStorage');

    // Sign out from Supabase
    await supabase.auth.signOut();

    // Clear all state
    setUser(null);
    setUserType(null);
    setUserRole(null);
    setBrokerageId(null);
    setBrokerProfile(null);
    setClientProfile(null);

    console.log('✓ Signed out successfully');
  };

  const isSuperAdminFunc = (): boolean => {
    // ROLE GUARD: Check email first, then role
    if (isSuperAdmin(user?.email)) {
      return true;
    }
    return userRole === 'super_admin';
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔐 Starting sign in process...');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Sign-in failed - no user data');

    console.log('✓ Authentication successful, fetching fresh profile from database...');

    // Explicitly fetch and set user profile before returning
    setUser(data.user);
    await determineUserType(data.user.id);

    console.log('✓ Sign in complete, profile loaded');
  };

  const brokerSignUp = async (email: string, password: string, profile: Omit<BrokerProfile, 'id' | 'brokerage_id'> & { brokerage_id?: string }) => {
    // NUCLEAR OPTION: Minimal signup with fixed brokerage_id
    const metadata: Record<string, any> = {
      role: 'broker',
      user_type: 'broker',
      brokerage_id: 'f67b67c8-086b-4b42-8d27-917a0783e9b0',
    };

    // Include profile fields if provided
    if (profile.full_name?.trim()) metadata.full_name = profile.full_name.trim();
    if (profile.id_number?.trim()) metadata.id_number = profile.id_number.trim();
    if (profile.cell_number?.trim()) metadata.cell_number = profile.cell_number.trim();
    if (profile.policy_number?.trim()) metadata.policy_number = profile.policy_number.trim();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    return authData.user;
  };

  const brokerSignIn = async (email: string, password: string) => {
    console.log('🔐 Starting broker sign in process...');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Sign-in failed - no user data');

    console.log('✓ Broker authentication successful, fetching fresh profile from database...');

    // Explicitly fetch and set user profile before returning
    setUser(data.user);
    await determineUserType(data.user.id);

    console.log('✓ Broker sign in complete, profile loaded');
  };

  const clientSignUp = async (email: string, password: string, profile: Omit<ClientProfile, 'id' | 'brokerage_id'>, brokerageId?: string) => {
    console.log('🔵 CLIENT SIGNUP - Creating client account');
    console.log('   Brokerage ID:', brokerageId);
    console.log('   Profile:', profile);

    const currentBrokerageId = brokerageId || brokerage?.id;

    if (!currentBrokerageId) {
      throw new Error('Brokerage not loaded. Please refresh the page.');
    }

    // Create auth user with metadata - database trigger will auto-create profiles
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: profile.full_name,
          email: profile.email,
          cell_number: profile.cell_number,
          role: 'client',
          brokerage_id: currentBrokerageId,
          user_type: 'client',
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    console.log('✅ Auth user created - database trigger will auto-create profile');

    return authData.user;
  };

  const clientSignIn = async (email: string, password: string) => {
    console.log('🔐 Starting client sign in process...');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Sign-in failed - no user data');

    console.log('✓ Client authentication successful, fetching fresh profile from database...');

    // Explicitly fetch and set user profile before returning
    setUser(data.user);
    await determineUserType(data.user.id);

    console.log('✓ Client sign in complete, profile loaded');
  };

  return (
    <AuthContext.Provider value={{ user, userType, userRole, brokerageId, brokerProfile, clientProfile, loading, signOut, signIn, brokerSignUp, brokerSignIn, clientSignUp, clientSignIn, isSuperAdmin: isSuperAdminFunc }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
