import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBrokerage } from '../contexts/BrokerageContext';
import { supabase } from '../lib/supabase';
import { Mail, Lock, AlertCircle, Loader } from 'lucide-react';

export default function Login({ roleType }: { roleType?: 'client' | 'broker' | null }) {
  const { signIn, userRole, userType, loading: authLoading } = useAuth();
  const { brokerage, isPlatformDomain } = useBrokerage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const broker = params.get('broker');
    const brokerId = params.get('brokerId');
    if (token || broker || brokerId || window.location.pathname === '/join') {
      setShowSignup(true);
    }
  }, []);

  // Wait for profile to load after login before navigation happens
  useEffect(() => {
    if (!authLoading && userType && userRole !== null) {
      console.log('✅ Profile loaded after login, navigation will occur');
      console.log('   User Type:', userType);
      console.log('   User Role:', userRole);
      console.log('   Dashboard:', userRole === 'super_admin' ? '/admin/brokerages' : '/claims');
    }
  }, [authLoading, userType, userRole]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      console.log('✓ Login successful, profile loaded');
      // Keep loading state active while redirecting
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  // Detect branding based on subdomain
  const getBrandingTitle = () => {
    if (brokerage?.name === 'Independi' || window.location.hostname.includes('independi')) {
      return 'Independi Claims Portal';
    }
    if (brokerage?.name) {
      return `${brokerage.name} Claims Portal`;
    }
    return 'Claims Portal';
  };

  const getBrandingDescription = () => {
    if (isPlatformDomain && roleType === 'broker') {
      return 'Access the platform admin dashboard';
    }
    return 'Sign in to your organisation\'s portal';
  };

  if (showSignup) {
    return <Signup onBackToLogin={() => setShowSignup(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {getBrandingTitle()}
          </h1>
          <p className="text-gray-600">
            {getBrandingDescription()}
          </p>
        </div>

        {loading && !error && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <Loader className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-800 font-medium">
              Initialising your professional dashboard...
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="remember-me-broker-login"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-blue-700 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="remember-me-broker-login" className="ml-2 text-sm text-gray-700">
              Remember Me
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            Sign In
          </button>
        </form>

        <div className="mt-6">
          {isPlatformDomain ? (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-center text-sm text-blue-800">
                Platform access is restricted to authorised administrators only.
              </p>
            </div>
          ) : brokerage ? (
            <p className="text-center text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={() => setShowSignup(true)}
                className="text-blue-600 font-semibold hover:text-blue-700"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-center text-sm text-amber-800">
                Registration is not available on this domain. Please contact your broker for access.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Signup({ onBackToLogin }: { onBackToLogin: () => void }) {
  const { brokerSignUp } = useAuth();
  const { brokerage, isPlatformDomain } = useBrokerage();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    idNumber: '',
    cellNumber: '',
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationBrokerageId, setInvitationBrokerageId] = useState<string | null>(null);
  const [invitationValid, setInvitationValid] = useState(false);
  const [invitationChecking, setInvitationChecking] = useState(false);
  const [invitationBrokerageName, setInvitationBrokerageName] = useState<string | null>(null);
  const [hasBrokerParam, setHasBrokerParam] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite');
    const brokerageId = params.get('brokerage');
    const legacyToken = params.get('token');
    const broker = params.get('broker');
    const brokerId = params.get('brokerId');

    if (broker || brokerId) {
      setHasBrokerParam(true);
      setInvitationBrokerageName('Independi');
      setInvitationBrokerageId('10000000-0000-0000-0000-000000000001');
    }

    if (inviteToken && brokerageId) {
      validateInvitation(inviteToken, brokerageId);
    } else if (legacyToken) {
      validateInvitation(legacyToken, null);
    }
  }, []);

  const validateInvitation = async (token: string, brokerageId: string | null) => {
    setInvitationChecking(true);
    try {
      const { data: invitationData, error: inviteError } = await supabase
        .from('invitations')
        .select('*, brokerages(id, name, subdomain)')
        .eq('token', token)
        .eq('is_active', true)
        .maybeSingle();

      if (inviteError || !invitationData) {
        setError('Invalid or expired invitation');
        return;
      }

      if (brokerageId && invitationData.brokerage_id !== brokerageId) {
        setError('Invitation does not match the specified brokerage');
        return;
      }

      const expiresAt = new Date(invitationData.expires_at);
      if (expiresAt < new Date()) {
        setError('This invitation has expired');
        return;
      }

      if (invitationData.max_uses && invitationData.used_count >= invitationData.max_uses) {
        setError('This invitation has reached its maximum number of uses');
        return;
      }

      setInvitationToken(token);
      setInvitationBrokerageId(invitationData.brokerage_id);
      setInvitationValid(true);
      setInvitationBrokerageName((invitationData.brokerages as any)?.name || 'Unknown Brokerage');
    } catch (err) {
      console.error('Error validating invitation:', err);
      setError('Failed to validate invitation');
    } finally {
      setInvitationChecking(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isPlatformDomain && !invitationToken && !hasBrokerParam) {
      setError('Cannot sign up on platform domain without invitation');
      return;
    }

    if (!invitationToken && !brokerage && !hasBrokerParam) {
      setError('Cannot sign up: No brokerage configuration found for this domain');
      return;
    }

    if (invitationToken && !invitationValid) {
      setError('Cannot sign up: Invalid or expired invitation');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      console.log('🟢 Signing up as BROKER');
      console.log('   Brokerage ID:', invitationBrokerageId);
      console.log('   Has broker param:', hasBrokerParam);

      await brokerSignUp(formData.email, formData.password, {
        full_name: formData.fullName,
        id_number: formData.idNumber,
        cell_number: formData.cellNumber,
        brokerage_id: invitationBrokerageId || undefined,
      });

      if (invitationToken) {
        const { error: updateError } = await supabase
          .from('invitations')
          .update({
            used_count: supabase.sql`used_count + 1`,
            updated_at: new Date().toISOString()
          })
          .eq('token', invitationToken);

        if (updateError) {
          console.error('Error updating invitation count:', updateError);
        }
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Independi Claims Portal</h1>
          <p className="text-gray-600 text-sm">Create your account to access the portal</p>
        </div>

        {loading && !error && !success && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <Loader className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-800 font-medium">
              Initialising your professional dashboard...
            </p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 font-semibold text-center">
              Account authorised. Redirecting to your dashboard...
            </p>
          </div>
        )}

        {invitationChecking && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">Validating invitation...</p>
          </div>
        )}

        {invitationToken && invitationValid && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <span className="font-semibold">✓ Invitation Accepted</span>
              <br />
              Registering with: {invitationBrokerageName || brokerage?.name}
            </p>
          </div>
        )}

        {hasBrokerParam && !invitationToken && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Registering with:</span> {invitationBrokerageName}
            </p>
          </div>
        )}

        {!invitationToken && !hasBrokerParam && brokerage && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Registering with:</span> {brokerage.name}
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!invitationToken && !brokerage && !hasBrokerParam && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">
              Cannot register: This domain is not configured for sign-ups. Please contact your broker for access.
            </p>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="John Doe"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID Number *
            </label>
            <input
              type="text"
              value={formData.idNumber}
              onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
              placeholder="YYMMDD..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cell Number *
            </label>
            <input
              type="tel"
              value={formData.cellNumber}
              onChange={(e) => setFormData({ ...formData, cellNumber: e.target.value })}
              placeholder="+27 71 123 4567"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your@email.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password *
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="remember-me-broker"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-blue-700 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="remember-me-broker" className="ml-2 text-sm text-gray-700">
              Remember Me
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || (!invitationValid && !brokerage && !hasBrokerParam) || invitationChecking}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            Create Account
          </button>
        </form>

        {!loading && !success && (
          <div className="mt-4 text-center">
            <p className="text-gray-600 text-sm">
              Already have an account?{' '}
              <button
                onClick={onBackToLogin}
                className="text-blue-600 font-semibold hover:text-blue-700"
              >
                Sign In
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
