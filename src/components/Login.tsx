import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBrokerage } from '../contexts/BrokerageContext';
import { Mail, Lock, AlertCircle, Loader, User, Phone, CreditCard } from 'lucide-react';
import { clearSupabaseSession, shouldResetSession } from '../utils/sessionClear';
import { isIndependiSubdomain, isOnBrokerageSubdomain } from '../utils/subdomain';
import ClientAuth from './ClientAuth';

// BROKERAGE ID FOR INDEPENDI
const INDEPENDI_BROKERAGE_ID = 'f67b67c8-086b-4b42-8d27-917a0783e9b0';

export default function Login({ roleType }: { roleType?: 'client' | 'broker' | null }) {
  const { signIn, userType, user, error: authError } = useAuth();
  const { brokerage } = useBrokerage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [sessionCleared, setSessionCleared] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signup') === 'true') {
      setShowSignup(true);
    }

    if (shouldResetSession() && !sessionCleared) {
      console.log('🔄 Reset flag detected - clearing session');
      clearSupabaseSession();
      setSessionCleared(true);

      const url = new URL(window.location.href);
      url.searchParams.delete('reset');
      window.history.replaceState({}, '', url.toString());
    }
  }, [sessionCleared]);

  // Redirect authenticated users
  if (user && userType) {
    console.log('✅ User authenticated, redirecting');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Account authorised. Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const safetyTimeout = setTimeout(() => {
      console.warn('⚠️ Login timeout - resetting button state');
      setLoading(false);
    }, 15000);

    console.log('🔐 Starting login attempt...');
    clearSupabaseSession();
    console.log('✓ Session cleared before login');

    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      await signIn(email, password);
      clearTimeout(safetyTimeout);
      console.log('✓ Sign-in successful');
    } catch (err: any) {
      clearTimeout(safetyTimeout);
      console.error('❌ Login failed:', err);
      setError(err.message || 'Sign-in failed');
      setLoading(false);

      console.log('🧹 Clearing session after failed login');
      clearSupabaseSession();

      setTimeout(() => {
        const currentPath = window.location.pathname;
        const currentSearch = window.location.search;
        if (!currentSearch.includes('reset=true')) {
          console.log('🔄 Redirecting with reset flag');
          window.location.href = `${currentPath}?reset=true`;
        }
      }, 2000);
    }
  };

  // On any brokerage subdomain - always show ClientAuth
  const hostname = window.location.hostname;
const isBrokerSubdomain = hostname.includes('.claimsportal.co.za') || hostname.includes('independi') || hostname === 'localhost';

if (showSignup && isBrokerSubdomain) {
    return <ClientAuth onBackToRole={() => setShowSignup(false)} />;
  }

  if (showSignup) {
    return <Signup onBackToLogin={() => setShowSignup(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {brokerage?.name || 'Claims'} Portal
          </h1>
          <p className="text-gray-600">
            Sign in to your organisation's portal
          </p>
        </div>

        {loading && !error && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <Loader className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-800 font-medium">
              Authorising account...
            </p>
          </div>
        )}

        {(error || authError) && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error || authError}</p>
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
          <p className="text-center text-gray-600">
            Don't have an account?{' '}
            <button
              onClick={() => setShowSignup(true)}
              className="text-blue-600 font-semibold hover:text-blue-700"
            >
              Sign-up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Signup({ onBackToLogin }: { onBackToLogin: () => void }) {
  const { brokerSignUp } = useAuth();
  const { brokerage } = useBrokerage();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    idNumber: '',
    cellNumber: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    console.log('🧹 Clearing session before signup');
    clearSupabaseSession();
    await new Promise(resolve => setTimeout(resolve, 100));

    const safetyTimeout = setTimeout(() => {
      console.warn('⚠️ Signup timeout - resetting button state');
      setLoading(false);
    }, 15000);

    // 3-SECOND TIMEOUT: Redirect regardless of database response
    const timeoutId = setTimeout(() => {
      console.log('⏰ 3-second timeout reached - redirecting anyway');
      clearTimeout(safetyTimeout);
      if (formData.email === 'vickypingo@gmail.com') {
        window.location.href = '/admin-dashboard';
      } else {
        window.location.href = '/broker-dashboard';
      }
    }, 3000);

    try {
      console.log('🔵 SIGNUP - Creating account with manual profile insert');
      console.log('   Email:', formData.email);
      console.log('   Brokerage ID:', INDEPENDI_BROKERAGE_ID);

      // Create user with manual profile creation
      await brokerSignUp(formData.email, formData.password, {
        full_name: formData.fullName,
        id_number: formData.idNumber,
        cell_number: formData.cellNumber,
        brokerage_id: INDEPENDI_BROKERAGE_ID,
      });

      console.log('✅ Sign-up complete, redirecting');
      clearTimeout(timeoutId);
      clearTimeout(safetyTimeout);

      // Redirect to appropriate dashboard
      if (formData.email === 'vickypingo@gmail.com') {
        window.location.href = '/admin-dashboard';
      } else {
        window.location.href = '/broker-dashboard';
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      clearTimeout(safetyTimeout);
      console.error('❌ SIGN-UP ERROR:', err);
      setError(err.message || 'Sign-up failed');
      setLoading(false);

      console.log('🧹 Clearing session after failed signup');
      clearSupabaseSession();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Create Account
          </h1>
          <p className="text-gray-600 text-sm">
            Register with {brokerage?.name || 'Independi'}
          </p>
        </div>

        {loading && !error && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <Loader className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-800 font-medium">
              Creating account...
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="John Smith"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cell Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={formData.cellNumber}
                onChange={(e) => setFormData({ ...formData, cellNumber: e.target.value })}
                placeholder="+27 82 123 4567"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID Number
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                placeholder="0000000000000"
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
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            Create Account
          </button>
        </form>

        <div className="mt-6">
          <p className="text-center text-gray-600">
            Already have an account?{' '}
            <button
              onClick={onBackToLogin}
              className="text-blue-600 font-semibold hover:text-blue-700"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
