import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

export function SetPassword() {
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
  const [sessionEstablished, setSessionEstablished] = useState(false);
  const [validatingSession, setValidatingSession] = useState(true);
  const [invitationRole, setInvitationRole] = useState('');

  useEffect(() => {
    const initializeSession = async () => {
      try {
        console.log('🔐 Initializing password setup session');

        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const brokerIdParam = params.get('brokerId');

        if (token) {
          setInvitationToken(token);
          console.log('🎫 Invitation token found:', token);
        }

        if (brokerIdParam) {
          setBrokerId(brokerIdParam);
          console.log('🏢 Broker ID found:', brokerIdParam);
        }

        const hash = window.location.hash;
        console.log('📍 Current hash:', hash);

        if (hash && hash.includes('access_token')) {
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          console.log('🔑 Found tokens in hash:', {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
          });

          if (accessToken && refreshToken) {
            console.log('🔄 Setting session from invite link tokens...');

            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.error('❌ Failed to set session:', sessionError);
              setError('Failed to establish session from invite link');
              setValidatingSession(false);
              return;
            }

            console.log('✅ Session established successfully');

            const { data: userData, error: userError } = await supabase.auth.getUser();

            if (userError || !userData.user) {
              console.error('❌ Failed to get user after session:', userError);
              setError('Failed to verify user session');
              setValidatingSession(false);
              return;
            }

            console.log('✅ User verified:', userData.user.email);
            setUserEmail(userData.user.email || '');
            setSessionEstablished(true);

            if (token) {
              await loadInvitationRole(token);
            }

            window.history.replaceState(
              null,
              '',
              window.location.pathname + window.location.search
            );
          } else {
            console.log('⚠️ Incomplete tokens in hash');
            setError('Invite link is incomplete');
            setValidatingSession(false);
            return;
          }
        } else {
          console.log('⚠️ No access token found in URL hash');

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            console.log('✅ User already authenticated:', user.email);
            setUserEmail(user.email || '');
            setSessionEstablished(true);

            if (token) {
              await loadInvitationRole(token);
            }
          } else {
            setError('Invite link is invalid or expired. Please request a new invite.');
            setValidatingSession(false);
            return;
          }
        }

        setValidatingSession(false);
      } catch (err) {
        console.error('❌ Error initializing session:', err);
        setError('Failed to initialize password setup');
        setValidatingSession(false);
      }
    };

    initializeSession();
  }, []);

  const loadInvitationRole = async (token: string) => {
    try {
      const { data: invitation } = await supabase
        .from('invitations')
        .select('role')
        .eq('token', token)
        .eq('is_active', true)
        .maybeSingle();

      if (invitation) {
        setInvitationRole(invitation.role);
        console.log('📋 Invitation role loaded:', invitation.role);
      }
    } catch (err) {
      console.warn('⚠️ Could not load invitation role:', err);
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
      console.log('🔐 Setting password for user');

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

      console.log('✅ Password set successfully for user:', updateData.user.id);

      // CRITICAL: Process invitation and update profile with correct role and brokerage_id
      if (invitationToken) {
        console.log('🎫 Processing invitation token:', invitationToken);

        try {
          // Step 1: Fetch invitation details
          const { data: invitation, error: inviteError } = await supabase
            .from('invitations')
            .select('role, brokerage_id, email, is_active, used_count, max_uses')
            .eq('token', invitationToken)
            .maybeSingle();

          if (inviteError) {
            console.error('❌ Error fetching invitation:', inviteError);
            throw new Error('Failed to fetch invitation details');
          }

          if (!invitation) {
            console.error('❌ Invitation not found for token:', invitationToken);
            throw new Error('Invitation not found');
          }

          console.log('📋 Invitation found:', {
            role: invitation.role,
            brokerage_id: invitation.brokerage_id,
            is_active: invitation.is_active,
            used_count: invitation.used_count,
            max_uses: invitation.max_uses,
          });

          // Step 2: Validate invitation
          if (!invitation.is_active) {
            console.error('❌ Invitation is not active');
            throw new Error('This invitation has been deactivated');
          }

          if (invitation.used_count >= invitation.max_uses) {
            console.error('❌ Invitation has been fully used');
            throw new Error('This invitation has already been used');
          }

          // Step 3: Update profile with correct role and brokerage_id
          console.log('📝 Updating profile for user:', updateData.user.id);
          console.log('   Setting role:', invitation.role);
          console.log('   Setting organization_id:', invitation.brokerage_id);

          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .upsert({
              id: updateData.user.id,
              user_id: updateData.user.id,
              organization_id: invitation.brokerage_id,
              role: invitation.role,
              email: invitation.email,
              full_name: invitation.email,
            }, {
              onConflict: 'id',
            });

          if (profileUpdateError) {
            console.error('❌ Failed to update profile:', profileUpdateError);
            throw new Error(`Failed to update profile: ${profileUpdateError.message}`);
          }

          console.log('✅ Profile updated successfully with role:', invitation.role);

          // Step 4: Mark invitation as used
          console.log('📝 Marking invitation as used');

          const { error: inviteUpdateError } = await supabase
            .from('invitations')
            .update({
              used_count: invitation.used_count + 1,
              is_active: false,
            })
            .eq('token', invitationToken);

          if (inviteUpdateError) {
            console.error('❌ Failed to update invitation:', inviteUpdateError);
            // Don't throw - profile is updated, this is not critical
          } else {
            console.log('✅ Invitation marked as used');
          }

        } catch (inviteErr) {
          console.error('❌ Invitation processing error:', inviteErr);
          setError(inviteErr instanceof Error ? inviteErr.message : 'Failed to process invitation');
          setLoading(false);
          return;
        }
      }

      setSuccess(true);
      setLoading(false);

      setTimeout(async () => {
        console.log('🚀 Redirecting user based on role');

        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (!currentUser) {
          window.location.href = '/';
          return;
        }

        // Fetch updated profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, organization_id')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        console.log('👤 User profile loaded:', {
          role: profile?.role,
          organization_id: profile?.organization_id,
        });

        const userRole = profile?.role || invitationRole;

        if (userRole === 'super_admin') {
          console.log('🔀 Redirecting to super admin dashboard');
          window.location.href = '/dashboard/admin';
        } else if (userRole === 'broker' || userRole === 'main_broker' || userRole === 'admin') {
          console.log('🔀 Redirecting to broker dashboard');

          if (profile?.organization_id) {
            const { data: brokerage } = await supabase
              .from('brokerages')
              .select('subdomain, slug')
              .eq('id', profile.organization_id)
              .maybeSingle();

            if (brokerage) {
              const brokerageSubdomain = brokerage.subdomain || brokerage.slug;

              if (brokerageSubdomain) {
                const currentHostname = window.location.hostname;

                if (currentHostname !== 'localhost' && currentHostname !== '127.0.0.1') {
                  const targetUrl = `https://${brokerageSubdomain}.claimsportal.co.za/dashboard/broker`;
                  console.log('🔀 Redirecting to brokerage subdomain:', targetUrl);
                  window.location.href = targetUrl;
                  return;
                }
              }
            }
          }

          window.location.href = '/dashboard/broker';
        } else {
          console.log('🔀 Redirecting to client dashboard');
          window.location.href = '/dashboard/client';
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

  if (validatingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="flex justify-center mb-4">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
          <p className="text-center text-slate-600">Validating invite link...</p>
        </div>
      </div>
    );
  }

  if (!sessionEstablished) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-red-600 p-3 rounded-full">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
            Invalid Invite Link
          </h1>

          <p className="text-center text-slate-600 mb-6">
            {error || 'This invite link is invalid or expired. Please request a new invite.'}
          </p>

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
            Password Set Successfully
          </h1>

          <p className="text-center text-slate-600 mb-6">
            Your password has been set. Redirecting to your dashboard...
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
