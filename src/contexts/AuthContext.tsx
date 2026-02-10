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
  brokerSignUp: (email: string, password: string, profile: Omit<BrokerProfile, 'id' | 'brokerage_id'>) => Promise<void>;
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        if (session?.user) {
          setUser(session.user);
          await determineUserType(session.user.id);
        }
        setLoading(false);
      })();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        console.log('Auth state changed:', event, session?.user?.id);

        if (session?.user) {
          setUser(session.user);
          setLoading(true);
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
      const { data: brokerUser, error: brokerError } = await supabase
        .from('broker_users')
        .select('brokerage_id')
        .eq('id', userId)
        .maybeSingle();

      if (brokerError) console.error('Error fetching broker user:', brokerError);

      if (brokerUser) {
        const { data: profile, error: profileError } = await supabase
          .from('broker_profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) console.error('Error fetching broker profile:', profileError);

        setUserType('broker');
        setBrokerageId(brokerUser.brokerage_id);
        if (profile) {
          setBrokerProfile(profile);
          setUserRole(profile.role || null);
        }
        return;
      }

      const { data: clientProfile, error: clientError } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (clientError) console.error('Error fetching client profile:', clientError);

      if (clientProfile) {
        setUserType('client');
        setBrokerageId(clientProfile.brokerage_id);
        setClientProfile(clientProfile);
        setUserRole(clientProfile.role || null);
        return;
      }

      console.warn('No profile found for user:', userId);
    } catch (error) {
      console.error('Error determining user type:', error);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserType(null);
    setUserRole(null);
    setBrokerageId(null);
    setBrokerProfile(null);
    setClientProfile(null);
  };

  const isSuperAdmin = (): boolean => {
    return userRole === 'super_admin';
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const brokerSignUp = async (email: string, password: string, profile: Omit<BrokerProfile, 'id' | 'brokerage_id'>) => {
    if (!brokerage?.id) {
      throw new Error('Brokerage not loaded. Please refresh the page.');
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    const currentBrokerageId = brokerage.id;

    const { error: brokerUserError } = await supabase
      .from('broker_users')
      .insert({
        id: authData.user.id,
        brokerage_id: currentBrokerageId,
        name: profile.full_name,
        phone: profile.cell_number,
        role: 'staff',
      });

    if (brokerUserError) throw brokerUserError;

    const { error: profileError } = await supabase
      .from('broker_profiles')
      .insert({
        id: authData.user.id,
        brokerage_id: currentBrokerageId,
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
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
