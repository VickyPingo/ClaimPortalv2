import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

export function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
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
        const brokerIdParam = params.get('brokerId') || params.get('brokerID') || params.get('brokerageId');

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
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return false;
    }
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
      // Step 1: Set the password
      console.log('🔐 Step 1: Setting password for user');

      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error('❌ Failed to set password:', updateError);
        throw new Error(`Failed to set password: ${updateError.message}`);
      }

      if (!updateData.user) {
        throw new Error('Failed to update user');
      }

      console.log('✅ Password set successfully for user:', updateData.user.id);

      // After successful password update, save the name
      if (fullName.trim()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({ full_name: fullName.trim() })
            .eq('user_id', user.id);
        }
      }

      // Step 2: Get authenticated user
      console.log('🔐 Step 2: Getting authenticated user');
      const { data: { user }, error: getUserError } = await supabase.auth.getUser();

      if (getUserError || !user) {
        console.error('❌ Failed to get authenticated user:', getUserError);
        throw new Error('Failed to get authenticated user');
      }

      console.log('✅ Authenticated user retrieved:', user.id);

      // Step 3: Process invitation if token exists
      let finalRole = 'broker';
      let finalBrokerageId = brokerId;

      if (invitationToken) {
        console.log('🎫 Step 3: Processing invitation token:', invitationToken);

        try {
          // Fetch invitation details
          const { data: invitation, error: inviteError } = await supabase
            .from('invitations')
            .select('role, brokerage_id, is_active, used_count, max_uses')
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

          console.log('✅ Invitation loaded:', {
            role: invitation.role,
            brokerage_id: invitation.brokerage_id,
            is_active: invitation.is_active,
            used_count: invitation.used_count,
            max_uses: invitation.max_uses,
          });

          // Validate invitation
          if (!invitation.is_active) {
            console.error('❌ Invitation is not active');
            throw new Error('This invitation has been deactivated');
          }

          if (invitation.max_uses && invitation.used_count >= invitation.max_uses) {
            console.error('❌ Invitation has been fully used');
            throw new Error('This invitation has already been used');
          }

          finalRole = invitation.role;
          finalBrokerageId = invitation.brokerage_id || finalBrokerageId;

          console.log('✅ Using invitation data - role:', finalRole, 'brokerage_id:', finalBrokerageId);

        } catch (inviteErr) {
          console.error('❌ Invitation processing error:', inviteErr);
          setError(inviteErr instanceof Error ? inviteErr.message : 'Failed to process invitation');
          setLoading(false);
          return;
        }
      } else {
        console.log('ℹ️ No invitation token - using defaults');
      }

      // Step 4: Upsert profile
      console.log('📝 Step 4: Upserting profile for user:', user.id);

      // Check for existing profile to preserve full_name
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('   Existing profile:', existingProfile ? 'found' : 'not found');

      // Helper to check if a string looks like an email
      const looksLikeEmail = (str: string | null | undefined): boolean => {
        if (!str) return false;
        return str.includes('@');
      };

      // NEVER set full_name to email - use null if no real name exists
      let safeName: string | null = null;
      if (existingProfile?.full_name && !looksLikeEmail(existingProfile.full_name)) {
        safeName = existingProfile.full_name;
      } else if (user.user_metadata?.full_name && !looksLikeEmail(user.user_metadata.full_name)) {
        safeName = user.user_metadata.full_name;
      }
      // If still null, leave it null - DO NOT use email

      const profileData = {
        user_id: user.id,
        brokerage_id: finalBrokerageId,
        role: finalRole,
        full_name: safeName,
      };

      console.log('   Profile data to upsert:', profileData);

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .upsert(profileData, {
          onConflict: 'user_id',
        });

      if (profileUpdateError) {
        console.error('❌ Failed to upsert profile:', profileUpdateError);
        throw new Error(`Failed to update profile: ${profileUpdateError.message}`);
      }

      console.log('✅ Profile upserted successfully with role:', finalRole);

      // Step 5: Mark invitation as used (if token exists)
      if (invitationToken) {
        console.log('📝 Step 5: Marking invitation as used');

        const { data: currentInvitation } = await supabase
          .from('invitations')
          .select('used_count, max_uses')
          .eq('token', invitationToken)
          .maybeSingle();

        if (currentInvitation) {
          const newUsedCount = currentInvitation.used_count + 1;
          const shouldDeactivate = currentInvitation.max_uses
            ? newUsedCount >= currentInvitation.max_uses
            : false;

          const { error: inviteUpdateError } = await supabase
            .from('invitations')
            .update({
              used_count: newUsedCount,
              is_active: shouldDeactivate ? false : true,
            })
            .eq('token', invitationToken);

          if (inviteUpdateError) {
            console.error('❌ Failed to update invitation:', inviteUpdateError);
            // Don't throw - profile is updated, this is not critical
          } else {
            console.log('✅ Invitation marked as used. Count:', newUsedCount, 'Active:', !shouldDeactivate);
          }
        }
      }

      setSuccess(true);
      setLoading(false);

      // Step 6: Redirect based on role
      setTimeout(async () => {
        console.log('🚀 Step 6: Redirecting user based on role:', finalRole);

        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (!currentUser) {
          window.location.href = '/';
          return;
        }

        // Fetch updated profile to get the actual role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, brokerage_id')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        console.log('👤 User profile loaded:', {
          role: profile?.role,
          brokerage_id: profile?.brokerage_id,
        });

        const userRole = profile?.role || finalRole;

        if (userRole === 'super_admin') {
          console.log('🔀 Redirecting to super admin dashboard');
          window.location.href = '/dashboard/admin';
        } else if (userRole === 'broker' || userRole === 'main_broker' || userRole === 'admin') {
          console.log('🔀 Redirecting to broker dashboard');

          if (profile?.brokerage_id) {
            const { data: brokerage } = await supabase
              .from('brokerages')
              .select('subdomain, slug')
              .eq('id', profile.brokerage_id)
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Smith"
              required
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

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
