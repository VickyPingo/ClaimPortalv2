import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBrokerage } from '../contexts/BrokerageContext';
import { supabase } from '../lib/supabase';
import { Mail, Lock, AlertCircle, Loader, ArrowLeft } from 'lucide-react';

export default function Login({ onBackToRole, roleType }: { onBackToRole?: () => void; roleType?: 'client' | 'broker' | null }) {
  const { signIn } = useAuth();
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
    if (token || window.location.pathname === '/join') {
      setShowSignup(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (showSignup) {
    return <Signup onBackToLogin={() => setShowSignup(false)} onBackToRole={onBackToRole} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        {onBackToRole && (
          <button
            onClick={onBackToRole}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {isPlatformDomain && roleType === 'broker' ? 'Super Admin Login' : 'Welcome Back'}
          </h1>
          <p className="text-gray-600">
            {isPlatformDomain && roleType === 'broker' ? 'Access the platform admin dashboard' : 'Sign in to your account'}
          </p>
        </div>

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
            className="w-full bg-blue-700 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            Sign In
          </button>
        </form>

        <div className="mt-6">
          {isPlatformDomain ? (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-center text-sm text-blue-800">
                Platform access is restricted to authorized administrators only.
              </p>
            </div>
          ) : brokerage ? (
            <p className="text-center text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={() => setShowSignup(true)}
                className="text-blue-700 font-semibold hover:text-blue-800"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-center text-sm text-amber-800">
                Sign up is not available on this domain. Please contact your broker for access.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Signup({ onBackToLogin, onBackToRole }: { onBackToLogin: () => void; onBackToRole?: () => void }) {
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
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationValid, setInvitationValid] = useState(false);
  const [invitationChecking, setInvitationChecking] = useState(false);
  const [invitationBrokerageName, setInvitationBrokerageName] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      validateInvitation(token);
    }
  }, []);

  const validateInvitation = async (token: string) => {
    setInvitationChecking(true);
    try {
      const hostname = window.location.hostname;
      const subdomain = hostname;

      const { data, error: validationError } = await supabase
        .rpc('validate_invitation', {
          token_param: token,
          subdomain_param: subdomain
        });

      if (validationError) {
        setError('Failed to validate invitation');
        return;
      }

      if (data && data.length > 0) {
        const validation = data[0];

        if (validation.is_valid) {
          setInvitationToken(token);
          setInvitationValid(true);
          setInvitationBrokerageName(validation.brokerage_name);
        } else {
          setError(validation.error_message || 'Invalid invitation');
        }
      }
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

    if (isPlatformDomain && !invitationToken) {
      setError('Cannot sign up on platform domain without invitation');
      return;
    }

    if (!invitationToken && !brokerage) {
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
      await brokerSignUp(formData.email, formData.password, {
        full_name: formData.fullName,
        id_number: formData.idNumber,
        cell_number: formData.cellNumber,
      });

      if (invitationToken) {
        await supabase.rpc('use_invitation', { token_param: invitationToken });
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {onBackToRole && (
          <button
            onClick={onBackToRole}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
        )}

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Create Account</h1>
          <p className="text-gray-600 text-sm">Create your account to get started</p>
        </div>

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

        {!invitationToken && brokerage && (
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

        {!invitationToken && !brokerage && (
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
            disabled={loading || (!invitationValid && !brokerage) || invitationChecking}
            className="w-full bg-blue-700 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            Create Account
          </button>
        </form>

        <div className="mt-4">
          <button
            onClick={onBackToLogin}
            className="w-full text-blue-700 font-semibold hover:text-blue-800 py-2"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
