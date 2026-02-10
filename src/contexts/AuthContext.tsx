import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useBrokerage } from './BrokerageContext';

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
  brokerSignUp: (email: string, password: string, profile: Omit<BrokerProfile, 'id' | 'brokerage_id'> & { brokerage_id?: string }) => Promise<void>;
  brokerSignIn: (email: string, password: string) => Promise<void>;
  clientSignUp: (email: string, password: string, profile: Omit<ClientProfile, 'id' | 'brokerage_id'>, brokerageId?: string) => Promise<void>;
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
    console.log('🚀 AuthContext initializing - fetching fresh session and profile from database');

    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        if (session?.user) {
          console.log('📦 Session found, fetching fresh profile from database');
          setUser(session.user);
          await determineUserType(session.user.id);
        } else {
          console.log('❌ No session found');
        }
        setLoading(false);
      })();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        console.log('🔄 Auth state changed:', event, session?.user?.id);

        if (session?.user) {
          setUser(session.user);
          setLoading(true);
          console.log('🔄 Refreshing profile from database');
          await determineUserType(session.user.id);
          setLoading(false);
        } else {
          setUser(null);
          setUserType(null);
          setUserRole(null);
          setBrokerageId(null);
          setBrokerProfile(null);
          setClientProfile(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const determineUserType = async (userId: string) => {
    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 DETERMINING USER TYPE FOR USER ID:', userId);
      console.log('⚠️ NO CACHE - FETCHING FRESH FROM DATABASE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Get current user's email for fallback check
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userEmail = currentUser?.email;
      console.log('📧 User email:', userEmail);

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
          setBrokerProfile(profile);
          let roleValue = profile.role || null;

          // FALLBACK: If email is vickypingo@gmail.com and no role, force super_admin
          if (!roleValue && userEmail === 'vickypingo@gmail.com') {
            console.log('🛡️ FALLBACK ACTIVATED: Setting vickypingo@gmail.com as super_admin');
            roleValue = 'super_admin';
          }

          setUserRole(roleValue);

          console.log('✓ Broker profile loaded');
          console.log('📋 Profile data:', JSON.stringify(profile, null, 2));
          console.log('📋 Role from DB:', profile.role);
          console.log('📋 User Type from DB:', profile.user_type);
          console.log('📋 Final Role Value:', roleValue);
          console.log('📋 Role type:', typeof roleValue);
          console.log('📋 Role === "super_admin":', roleValue === 'super_admin');
          console.log('👑 Is Super Admin (computed):', roleValue === 'super_admin');
        } else {
          console.warn('⚠️ No broker profile found for user:', userId);

          // FALLBACK: If no profile but email is vickypingo@gmail.com, force super_admin
          if (userEmail === 'vickypingo@gmail.com') {
            console.log('🛡️ FALLBACK ACTIVATED: No profile but email is vickypingo@gmail.com - forcing super_admin');
            setUserRole('super_admin');
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
        console.log('✓ User is a client');
        setUserType('client');
        setBrokerageId(clientProfile.brokerage_id);
        setClientProfile(clientProfile);
        setUserRole(clientProfile.role || null);

        console.log('📋 Role from DB:', clientProfile.role);
        console.log('📋 User Type from DB:', clientProfile.user_type);
        return;
      }

      console.warn('⚠️ No profile found for user:', userId);

      // FALLBACK: If nothing worked but email is vickypingo@gmail.com, force super_admin
      if (userEmail === 'vickypingo@gmail.com') {
        console.log('🛡️ FALLBACK ACTIVATED: No profile found but email is vickypingo@gmail.com - forcing super_admin and broker type');
        setUserType('broker');
        setUserRole('super_admin');
      }
    } catch (error) {
      console.error('❌ Error determining user type:', error);

      // FALLBACK: On any error, check email
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.email === 'vickypingo@gmail.com') {
        console.log('🛡️ FALLBACK ACTIVATED: Error occurred but email is vickypingo@gmail.com - forcing super_admin');
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

  const isSuperAdmin = (): boolean => {
    return userRole === 'super_admin';
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔐 Starting sign in process...');

    // Clear any cached data before signing in
    window.localStorage.clear();
    window.sessionStorage.clear();
    console.log('🧹 Cleared all cached data (localStorage + sessionStorage)');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Sign in failed - no user data');

    console.log('✓ Authentication successful, fetching fresh profile from database...');

    // Explicitly fetch and set user profile before returning
    setUser(data.user);
    await determineUserType(data.user.id);

    console.log('✓ Sign in complete, profile loaded');
  };

  const brokerSignUp = async (email: string, password: string, profile: Omit<BrokerProfile, 'id' | 'brokerage_id'> & { brokerage_id?: string }) => {
    const targetBrokerageId = profile.brokerage_id || brokerage?.id;

    if (!targetBrokerageId) {
      throw new Error('Brokerage not loaded. Please refresh the page or use a valid invitation link.');
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    const { error: brokerUserError } = await supabase
      .from('broker_users')
      .insert({
        id: authData.user.id,
        brokerage_id: targetBrokerageId,
        name: profile.full_name,
        phone: profile.cell_number,
        role: 'staff',
      });

    if (brokerUserError) throw brokerUserError;

    const { error: profileError } = await supabase
      .from('broker_profiles')
      .insert({
        id: authData.user.id,
        brokerage_id: targetBrokerageId,
        full_name: profile.full_name,
        id_number: profile.id_number,
        cell_number: profile.cell_number,
        policy_number: profile.policy_number || null,
      });

    if (profileError) throw profileError;

    setUser(authData.user);
    await determineUserType(authData.user.id);
  };

  const brokerSignIn = async (email: string, password: string) => {
    console.log('🔐 Starting broker sign in process...');

    // Clear any cached data before signing in
    window.localStorage.clear();
    window.sessionStorage.clear();
    console.log('🧹 Cleared all cached data (localStorage + sessionStorage)');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Sign in failed - no user data');

    console.log('✓ Broker authentication successful, fetching fresh profile from database...');

    // Explicitly fetch and set user profile before returning
    setUser(data.user);
    await determineUserType(data.user.id);

    console.log('✓ Broker sign in complete, profile loaded');
  };

  const clientSignUp = async (email: string, password: string, profile: Omit<ClientProfile, 'id' | 'brokerage_id'>, brokerageId?: string) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    const currentBrokerageId = brokerageId || brokerage?.id;

    if (!currentBrokerageId) {
      throw new Error('Brokerage not loaded. Please refresh the page.');
    }

    const { error: profileError } = await supabase
      .from('client_profiles')
      .insert({
        id: authData.user.id,
        brokerage_id: currentBrokerageId,
        full_name: profile.full_name,
        email: profile.email,
        cell_number: profile.cell_number,
      });

    if (profileError) throw profileError;

    setUser(authData.user);
    await determineUserType(authData.user.id);
  };

  const clientSignIn = async (email: string, password: string) => {
    console.log('🔐 Starting client sign in process...');

    // Clear any cached data before signing in
    window.localStorage.clear();
    window.sessionStorage.clear();
    console.log('🧹 Cleared all cached data (localStorage + sessionStorage)');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Sign in failed - no user data');

    console.log('✓ Client authentication successful, fetching fresh profile from database...');

    // Explicitly fetch and set user profile before returning
    setUser(data.user);
    await determineUserType(data.user.id);

    console.log('✓ Client sign in complete, profile loaded');
  };

  return (
    <AuthContext.Provider value={{ user, userType, userRole, brokerageId, brokerProfile, clientProfile, loading, signOut, signIn, brokerSignUp, brokerSignIn, clientSignUp, clientSignIn, isSuperAdmin }}>
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
