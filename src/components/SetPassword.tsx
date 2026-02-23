import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

export function SetPassword() {
  const { completePasswordSetup } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [invitationToken, setInvitationToken] = useState('');
  const [brokerId, setBrokerId] = useState('');
  const [invitationValid, setInvitationValid] = useState<boolean | null>(null);
  const [invitationRole, setInvitationRole] = useState('');
  const [validationError, setValidationError] = useState<string>('');

  useEffect(() => {
    // Check for invitation token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const brokerIdParam = params.get('brokerId');

    if (token) {
      console.log('🔗 Invitation token found:', token);
      setInvitationToken(token);
      if (brokerIdParam) {
        setBrokerId(brokerIdParam);
      }
      validateInvitationToken(token);
    } else {
      // No token - check if user is already authenticated
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) {
          setUserEmail(user.email);
          setInvitationValid(true); // Already authenticated user
        } else {
          setInvitationValid(false); // No token and not authenticated
        }
      });
    }

    if (window.location.hash) {
      console.log('🧹 Clearing URL hash');
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const validateInvitationToken = async (token: string) => {
    try {
      console.log('🔍 Validating invitation token:', token);
      console.log('🔍 Making Supabase query...');

      const { data: invitation, error } = await supabase
        .from('invitations')
        .select('*,brokerages(name,subdomain)')
        .eq('token', token)
        .eq('is_active', true)
        .maybeSingle();

      console.log('📊 Query response:', { invitation, error });
      console.log('📊 Error details:', error);
      console.log('📊 Invitation data:', invitation);

      if (error) {
        console.error('❌ Error validating invitation:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error details:', error.details);
        console.error('❌ Error hint:', error.hint);
        setInvitationValid(false);

        // Build detailed error message for debugging
        let errorDetails = `Database error: ${error.message}`;
        if (error.code) {
          errorDetails += ` (Code: ${error.code})`;
        }
        if (error.hint) {
          errorDetails += ` - Hint: ${error.hint}`;
        }
        if (error.details) {
          errorDetails += ` - Details: ${error.details}`;
        }

        setError('Failed to validate invitation');
        setValidationError(errorDetails);
        return;
      }

      if (!invitation) {
        console.log('❌ Invitation not found or inactive');
        console.log('❌ Token searched:', token);
        setInvitationValid(false);
        setError('Invalid or expired invitation link');
        setValidationError(`No active invitation found with token: ${token.substring(0, 8)}...`);
        return;
      }

      // Check if expired
      if (new Date(invitation.expires_at) < new Date()) {
        console.log('❌ Invitation expired');
        setInvitationValid(false);
        setError('This invitation has expired');
        setValidationError(`Expired on: ${new Date(invitation.expires_at).toLocaleString()}`);
        return;
      }

      // Check if maxed out
      if (invitation.max_uses && invitation.used_count >= invitation.max_uses) {
        console.log('❌ Invitation max uses reached');
        setInvitationValid(false);
        setError('This invitation has reached its maximum uses');
        setValidationError(`Used ${invitation.used_count} of ${invitation.max_uses} times`);
        return;
      }

      console.log('✅ Invitation is valid');
      setInvitationValid(true);
      setInvitationRole(invitation.role);
      if (invitation.email) {
        setUserEmail(invitation.email);
      }
    } catch (err) {
      console.error('❌ Error validating invitation:', err);
      setInvitationValid(false);
      setError('Failed to validate invitation');
      setValidationError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };

  const validatePassword = () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validatePassword()) {
      return;
    }

    setLoading(true);

    try {
      console.log('🔐 Setting password for invited user');

      // If we have an invitation token, create a new user account
      if (invitationToken) {
        console.log('📝 Creating new user account with invitation');

        if (!userEmail) {
          throw new Error('Email is required for signup');
        }

        // Get brokerage code from URL if present (for client signup)
const params = new URLSearchParams(window.location.search);
const signupCode = params.get("b");

const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
  email: userEmail,
  password: password,
  options: {
    data: {
      invitation_token: invitationToken,
      role: invitationRole || "client",
      signup_code: signupCode,   // <-- THIS is the important line
    },
  },
});

        if (signUpError) {
          console.error('❌ Failed to sign up:', signUpError);
          throw signUpError;
        }

        if (!signUpData.user) {
          throw new Error('Failed to create user');
        }

        console.log('✅ User created successfully');

        // Mark invitation as used - increment the counter
        const { data: invitationData, error: fetchError } = await supabase
          .from('invitations')
          .select('used_count')
          .eq('token', invitationToken)
          .maybeSingle();

        if (!fetchError && invitationData) {
          const { error: updateError } = await supabase
            .from('invitations')
            .update({ used_count: invitationData.used_count + 1 })
            .eq('token', invitationToken);

          if (updateError) {
            console.warn('⚠️ Failed to update invitation count:', updateError);
          }
        }
      } else {
        // Existing user setting password
        const { data: updateData, error: updateError } = await supabase.auth.updateUser({
          password: password,
        });

        if (updateError) {
          console.error('❌ Failed to set password:', updateError);
          throw updateError;
        }

        if (!updateData.user) {
          throw new Error('Failed to update user');
        }

        console.log('✓ Password set successfully');
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Failed to get user after password set');
      }

      console.log('🔍 Fetching user profile and role...');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, brokerage_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('⚠️ Profile fetch error:', profileError);
      }

      if (profile) {
        console.log('✓ Profile found:', { role: profile.role });
        console.log('🚀 Password set successfully - showing confirmation');
      } else {
        console.log('⚠️ No profile found yet - will be created by trigger');
      }

      setSuccess(true);
      setLoading(false);

      setTimeout(async () => {
        console.log('🚀 Completing password setup and routing to dashboard');

        // Redirect based on role
        if (profile) {
          if (profile.role === 'super_admin') {
            window.location.href = '/admin-dashboard';
          } else if (profile.role === 'broker' || profile.role === 'admin') {
            window.location.href = '/broker-dashboard';
          } else if (profile.role === 'client') {
            window.location.href = '/claims-portal';
          } else {
            await completePasswordSetup();
          }
        } else {
          await completePasswordSetup();
        }
      }, 2000);
    } catch (err) {
      console.error('❌ Set password error:', err);
      setError(err instanceof Error ? err.message : 'Failed to set password');
      setLoading(false);
    }
  };

  const passwordStrength = () => {
    if (password.length === 0) return { label: '', color: '' };
    if (password.length < 6) return { label: 'Too short', color: 'text-red-500' };
    if (password.length < 8) return { label: 'Weak', color: 'text-orange-500' };
    if (password.length < 12) return { label: 'Good', color: 'text-blue-500' };
    return { label: 'Strong', color: 'text-green-500' };
  };

  const strength = passwordStrength();

  // Show error if invitation is invalid
  if (invitationValid === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-red-600 p-3 rounded-full">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
            Invalid Invitation Link
          </h1>

          <p className="text-center text-slate-600 mb-4">
            {error || 'This invitation link is invalid, expired, or has already been used.'}
          </p>

          {validationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-semibold text-red-900 mb-1">Technical Details:</p>
              <p className="text-xs text-red-700 font-mono break-words">
                {validationError}
              </p>
            </div>
          )}

          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // Show loading while validating invitation
  if (invitationValid === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="flex justify-center mb-4">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
          <p className="text-center text-slate-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-green-600 p-3 rounded-full">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
            Organisation Account Activated
          </h1>

          <p className="text-center text-slate-600 mb-6">
            Your password has been set successfully. Redirecting to your dashboard...
          </p>

          <div className="flex justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-blue-600 p-3 rounded-full">
            <Lock className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
          Set Your Password
        </h1>

        <p className="text-center text-slate-600 mb-6">
          Welcome! Please set a secure password for your account
          {userEmail && <span className="block mt-1 font-medium">{userEmail}</span>}
        </p>

        <form onSubmit={handleSetPassword} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {password && (
              <p className={`text-sm mt-1 ${strength.color}`}>
                {strength.label}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Confirm your password"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword && password === confirmPassword && (
              <div className="flex items-center gap-1 mt-1 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Passwords match</span>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || password.length < 6 || password !== confirmPassword}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Setting Password...' : 'Set Password & Continue'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-slate-900 mb-2 text-sm">Password Requirements:</h3>
          <ul className="space-y-1 text-xs text-slate-600">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Minimum 6 characters (8+ recommended)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Use a unique password you don't use elsewhere</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
