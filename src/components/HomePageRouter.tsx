import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Login from './Login';
import BrokerAdminDashboard from './admin/BrokerAdminDashboard';
import ClientPortal from './ClientPortal';
import { SetPassword } from './SetPassword';
import ForceSession from './ForceSession';
import { LogOut, AlertCircle, Building2 } from 'lucide-react';
import { isIndependiSubdomain, isSuperAdminDomain } from '../utils/subdomain';

export default function HomePageRouter() {
  const { user, userType, userRole, loading, needsPasswordSetup, brokerProfile, clientProfile, signOut, isSuperAdmin } = useAuth();
  const [profileWaitTime, setProfileWaitTime] = useState(0);

  const onIndependiSubdomain = isIndependiSubdomain();
  const onSuperAdminDomain = isSuperAdminDomain();

  console.log('🌐 Router state:');
  console.log('  User Type:', userType);
  console.log('  User Role:', userRole);
  console.log('  On Independi Subdomain:', onIndependiSubdomain);
  console.log('  On Super Admin Domain:', onSuperAdminDomain);
  console.log('  Broker Profile:', brokerProfile);
  console.log('  Client Profile:', clientProfile);

  const currentPath = window.location.pathname;

  // SET PASSWORD ROUTE: Show SetPassword component for Supabase invite flow
  // This MUST come before any auth checks to allow unauthenticated users to set their password
  if (currentPath === '/set-password') {
    console.log('🔐 Set password route - showing SetPassword for invite');
    return <SetPassword />;
  }

  // SIGNUP ROUTE: Show SetPassword component for invitation flow
  if (currentPath === '/signup') {
    console.log('📝 Signup route - showing SetPassword for invitation');
    return <SetPassword />;
  }

  // EMERGENCY: Force session page
  if (currentPath === '/admin/force-session') {
    console.log('🚨 EMERGENCY: Force session page accessed');
    return <ForceSession />;
  }

  // EMERGENCY: Direct /admin access for super admins
  const isSuperAdminEmail = user?.email === 'vickypingo@gmail.com';
  if ((currentPath === '/admin' || currentPath === '/dashboard/admin') && isSuperAdminEmail && userRole === 'super_admin') {
    console.log('🔓 EMERGENCY ADMIN ACCESS: Super admin accessing /admin directly');
    return (
      <>
        <EmergencyLogoutButton />
        <BrokerAdminDashboard />
      </>
    );
  }

  useEffect(() => {
    // CRITICAL: Wait for auth and profile to fully load before any redirects
    if (loading) {
      console.log('⏳ Auth still loading - skipping redirect logic');
      return;
    }

    if (!user) return;

    // ADMIN OVERRIDE: vickypingo@gmail.com bypasses all subdomain restrictions
    const isSuperAdminEmail = user.email === 'vickypingo@gmail.com';

    // CRITICAL: Clients should never access broker or admin routes - CHECK THIS FIRST
    const clientRestrictedPaths = ['/broker-dashboard', '/admin-dashboard', '/organisations', '/users-management', '/invitations', '/admin-settings'];
    const isClientRestrictedPath = clientRestrictedPaths.some(path => currentPath.toLowerCase().includes(path.toLowerCase()));

    if (isClientRestrictedPath && (userRole === 'client' || userType === 'client')) {
      console.log('❌ CLIENT ATTEMPTING TO ACCESS RESTRICTED PATH:', currentPath);
      console.log('  Redirecting to claims portal');
      window.history.replaceState(null, '', '/claims-portal');
      return;
    }

    // CRITICAL: On Independi subdomain (claims.independi.co.za), FORCE broker dashboard
    // EXCEPT for vickypingo@gmail.com who always has full super admin access
    // EXCEPT for clients who should go to claims portal
    if (onIndependiSubdomain && !isSuperAdminEmail && userRole !== 'client' && userType !== 'client') {
      console.log('🔒 INDEPENDI SUBDOMAIN - FORCING BROKER ACCESS ONLY');

      if (currentPath !== '/broker-dashboard' && currentPath !== '/') {
        console.log('  Redirecting to broker dashboard');
        window.history.replaceState(null, '', '/broker-dashboard');
      } else if (currentPath === '/') {
        window.history.replaceState(null, '', '/broker-dashboard');
      }
      return;
    }

    // CRITICAL: Brokers should never access super admin routes
    const brokerRestrictedPaths = ['/organisations', '/users-management', '/invitations', '/admin-settings'];
    const isBrokerRestrictedPath = brokerRestrictedPaths.some(path => currentPath.toLowerCase().includes(path.toLowerCase()));

    if (isBrokerRestrictedPath && userRole === 'broker') {
      console.log('❌ BROKER ATTEMPTING TO ACCESS RESTRICTED PATH:', currentPath);
      console.log('  Redirecting to broker dashboard');
      window.history.replaceState(null, '', '/broker-dashboard');
      return;
    }

    // Determine the correct path based on role
    let targetPath = '/';

    // ═══════════════════════════════════════════════════════════════
    // SUPER ADMIN ROUTING - HIGHEST PRIORITY
    // ═══════════════════════════════════════════════════════════════
    if (userRole === 'super_admin' || isSuperAdmin()) {
      console.log('👑 SUPER ADMIN ROUTING: /admin-dashboard');
      targetPath = '/admin-dashboard';
    }
    // ═══════════════════════════════════════════════════════════════
    // CLIENT ROUTING - SECOND PRIORITY (before broker)
    // ═══════════════════════════════════════════════════════════════
    else if (userType === 'client' || userRole === 'client') {
      console.log('👤 CLIENT ROUTING: /claims-portal');
      targetPath = '/claims-portal';
    }
    // ═══════════════════════════════════════════════════════════════
    // BROKER ROUTING - ONLY IF NOT SUPER ADMIN OR CLIENT
    // ═══════════════════════════════════════════════════════════════
    else if ((userType === 'broker' || userRole === 'broker' || userRole === 'main_broker') && userRole !== 'super_admin' && userRole !== 'client') {
      console.log('🏢 BROKER ROUTING: /broker-dashboard');
      targetPath = '/broker-dashboard';
    }

    // Redirect if not on the correct path - prevent redirect loops
    if (targetPath && currentPath !== targetPath) {
      console.log(`🔀 Redirecting from ${currentPath} to ${targetPath}`);
      window.history.replaceState(null, '', targetPath);
    } else if (targetPath && currentPath === '/') {
      console.log(`🔀 Redirecting from home to ${targetPath}`);
      window.history.replaceState(null, '', targetPath);
    }
  }, [user, userType, userRole, currentPath, isSuperAdmin, onIndependiSubdomain, onSuperAdminDomain, loading]);

  // Profile wait timeout - show welcome page after 3 seconds if no profile
  useEffect(() => {
    if (!user) return;

    const timer = setInterval(() => {
      setProfileWaitTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [user]);

  const handleForceLogout = async () => {
    console.log('🧹 FORCING COMPLETE LOGOUT AND CACHE CLEAR');
    localStorage.clear();
    sessionStorage.clear();
    await signOut();
    window.history.replaceState(null, '', '/');
    window.location.reload();
  };

  const EmergencyLogoutButton = () => (
    <button
      onClick={handleForceLogout}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-sm rounded-lg shadow-lg hover:bg-red-700 transition-colors"
      title="Clear cache and force logout"
    >
      <LogOut className="w-4 h-4" />
      Force Logout
    </button>
  );

  // STEP 1: If not logged in, show login
  if (!user) {
    return <Login roleType={null} />;
  }

  // STEP 1.5: SUPER ADMIN BYPASS - Super admins skip password setup and go straight to dashboard
  // CRITICAL: Check email ONLY - role may not be set yet in database
  if (user.email === 'vickypingo@gmail.com') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👑 SUPER ADMIN OVERRIDE - vickypingo@gmail.com');
    console.log('✅ BYPASSING PASSWORD SETUP - FULL SUPER ADMIN ACCESS GRANTED');
    console.log('   Subdomain:', window.location.hostname);
    console.log('   User Role:', userRole);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return (
      <>
        <EmergencyLogoutButton />
        <BrokerAdminDashboard />
      </>
    );
  }

  // STEP 1.6: If user is invited and needs to set password (non-super-admins only)
  if (needsPasswordSetup) {
    console.log('🔐 User needs to set password - showing SetPassword component');
    return <SetPassword />;
  }

  // STEP 1.7: CRITICAL - Wait for auth and profile to load before routing
  // This prevents redirect loops by ensuring userRole and userType are set
  // Also prevents flash to /broker-dashboard before userRole is determined
  if (loading || !userRole) {
    console.log('⏳ Auth/profile still loading - showing loading screen', { loading, userRole });
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-700 border-t-transparent rounded-full mx-auto mb-6"></div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Loading your account...</h2>
          <p className="text-gray-600">Please wait while we set things up</p>
        </div>
      </div>
    );
  }

  // STEP 2: Check if client is trying to access broker/admin routes
  if ((currentPath === '/broker-dashboard' || currentPath === '/admin-dashboard') &&
      (userType === 'client' || userRole === 'client')) {
    console.log('❌ CLIENT TRYING TO ACCESS RESTRICTED ROUTE - REDIRECTING TO CLAIMS PORTAL');
    console.log('  User Role:', userRole);
    console.log('  User Type:', userType);
    console.log('  Current Path:', currentPath);
    window.location.replace('/claims-portal');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to your portal...</p>
        </div>
      </div>
    );
  }

  // STEP 3: ADMIN OVERRIDE - Already handled in STEP 1.5 (moved up for priority)

  // STEP 4: SUBDOMAIN ENFORCEMENT - Independi subdomain ONLY shows broker dashboard (for non-super-admins)
  // CRITICAL: Clients should go to claims portal even on Independi subdomain
  if (onIndependiSubdomain) {
    // If user is a client, redirect to claims portal
    if (userType === 'client' || userRole === 'client') {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🏢 INDEPENDI SUBDOMAIN - CLIENT REDIRECTING TO PORTAL');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return (
        <>
          <EmergencyLogoutButton />
          <ClientPortal />
        </>
      );
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏢 INDEPENDI SUBDOMAIN - BROKER ONLY ACCESS');
    console.log('✅ FORCING BROKER DASHBOARD VIEW');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return (
      <>
        <EmergencyLogoutButton />
        <BrokerAdminDashboard />
      </>
    );
  }

  // STEP 5: SUPER ADMIN ROUTING (only on super admin domain)
  if ((isSuperAdmin() || userRole === 'super_admin') && onSuperAdminDomain) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👑 SUPER ADMIN DETECTED ON ADMIN DOMAIN');
    console.log('✅ ROUTING TO: /admin-dashboard');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return (
      <>
        <EmergencyLogoutButton />
        <BrokerAdminDashboard />
      </>
    );
  }

  // STEP 6: CLIENT ROUTING - MUST COME BEFORE BROKER ROUTING
  // CRITICAL: Check client role first to prevent clients from accessing broker dashboard
  if (userType === 'client' || userRole === 'client') {
    console.log('✅ ROUTING TO: /claims-portal (userType: client, userRole: client)');
    return (
      <>
        <EmergencyLogoutButton />
        <ClientPortal />
      </>
    );
  }

  // STEP 7: BROKER ROUTING
  // CRITICAL: Super admins should NEVER be treated as brokers
  // CRITICAL: Clients should NEVER reach this point
  if ((userType === 'broker' || userRole === 'broker' || userRole === 'main_broker') &&
      userRole !== 'super_admin' &&
      userRole !== 'client' &&
      !isSuperAdmin()) {
    console.log('✅ ROUTING TO: /broker-dashboard (userType: broker)');
    return (
      <>
        <EmergencyLogoutButton />
        <BrokerAdminDashboard />
      </>
    );
  }

  // FALLBACK: Profile not found after 3 seconds - show welcome page
  // CRITICAL: Super admins bypass this and get direct access to admin dashboard
  if (profileWaitTime >= 3) {
    if (isSuperAdminEmail) {
      console.log('👑 SUPER ADMIN BYPASS: Profile not found but granting admin access anyway');
      return (
        <>
          <EmergencyLogoutButton />
          <BrokerAdminDashboard />
        </>
      );
    }

    console.log('⚠️ Profile not found after 3 seconds - showing welcome page');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <EmergencyLogoutButton />
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <Building2 className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome!</h2>
          <p className="text-gray-600 mb-4">
            Your account has been created successfully. We're setting up your profile.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            If this takes too long, please refresh the page or contact support.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors mb-3"
          >
            Refresh Page
          </button>
          <button
            onClick={handleForceLogout}
            className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // FALLBACK: Still loading or no role detected
  // CRITICAL: Super admins get access even without profile after 2 seconds
  if (isSuperAdminEmail && profileWaitTime >= 2) {
    console.log('👑 SUPER ADMIN BYPASS: Role not determined but granting admin access anyway');
    return (
      <>
        <EmergencyLogoutButton />
        <BrokerAdminDashboard />
      </>
    );
  }

  console.log('⚠️ UserType/Role not determined yet, showing loading state');
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Connecting to server...</p>
        <p className="text-sm text-gray-500 mt-2">{profileWaitTime}s</p>
      </div>
    </div>
  );
}
