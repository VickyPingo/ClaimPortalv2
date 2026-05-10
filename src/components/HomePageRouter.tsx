import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Login from './Login';
import BrokerAdminDashboard from './admin/BrokerAdminDashboard';
import ClientPortal from './ClientPortal';
import { SetPassword } from './SetPassword';
import ForgotPassword from './ForgotPassword';
import ForceSession from './ForceSession';
import { LogOut, AlertCircle, Building2 } from 'lucide-react';
import { isIndependiSubdomain, isSuperAdminDomain, isOnBrokerageSubdomain } from '../utils/subdomain';

export default function HomePageRouter() {
  const { user, userType, userRole, loading, needsPasswordSetup, brokerProfile, clientProfile, signOut, isSuperAdmin } = useAuth();
  const [profileWaitTime, setProfileWaitTime] = useState(0);

  const onSuperAdminDomain = isSuperAdminDomain();
  const onBrokerageSubdomain = !onSuperAdminDomain && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.hostname.includes('.claimsportal.co.za');

  console.log('🌐 Router state:');
  console.log('  User Type:', userType);
  console.log('  User Role:', userRole);
  console.log('  Loading:', loading);
  console.log('  On Brokerage Subdomain:', onBrokerageSubdomain);
  console.log('  On Super Admin Domain:', onSuperAdminDomain);

  const currentPath = window.location.pathname;
  const isSuperAdminEmail = user?.email === 'vickypingo@gmail.com';

  // SET PASSWORD ROUTE
  if (currentPath === '/set-password') {
    return <SetPassword />;
  }

  // SIGNUP ROUTE
  if (currentPath === '/signup') {
    return <SetPassword />;
  }

  // FORGOT PASSWORD ROUTE
  if (currentPath === '/forgot-password') {
    return <ForgotPassword onBack={() => window.history.replaceState(null, '', '/')} />;
  }

  // EMERGENCY: Force session page
  if (currentPath === '/admin/force-session') {
    return <ForceSession />;
  }

  // EMERGENCY: Direct /admin access for super admins
  if ((currentPath === '/admin' || currentPath === '/dashboard/admin') && isSuperAdminEmail && userRole === 'super_admin') {
    return (
      <>
        <EmergencyLogoutButton onLogout={handleForceLogout} />
        <BrokerAdminDashboard />
      </>
    );
  }

  useEffect(() => {
    if (loading) {
      console.log('⏳ Auth still loading - skipping redirect logic');
      return;
    }

    if (!user) return;

    const isSuperAdminEmail = user.email === 'vickypingo@gmail.com';

    const clientRestrictedPaths = ['/broker-dashboard', '/admin-dashboard', '/organisations', '/users-management', '/invitations', '/admin-settings'];
    const isClientRestrictedPath = clientRestrictedPaths.some(path => currentPath.toLowerCase().includes(path.toLowerCase()));

    if (isClientRestrictedPath && (userRole === 'client' || userType === 'client')) {
      console.log('❌ CLIENT ATTEMPTING TO ACCESS RESTRICTED PATH:', currentPath);
      window.history.replaceState(null, '', '/claims-portal');
      return;
    }

    const isConfirmedBroker =
      userRole === 'broker' ||
      userRole === 'main_broker' ||
      userRole === 'super_admin' ||
      userType === 'broker';

    if (onBrokerageSubdomain && !isSuperAdminEmail && isConfirmedBroker) {
      console.log('🔒 BROKERAGE SUBDOMAIN - CONFIRMED BROKER ACCESS');
      if (currentPath !== '/broker-dashboard') {
        window.history.replaceState(null, '', '/broker-dashboard');
      }
      return;
    }

    const brokerRestrictedPaths = ['/organisations', '/users-management', '/invitations', '/admin-settings'];
    const isBrokerRestrictedPath = brokerRestrictedPaths.some(path => currentPath.toLowerCase().includes(path.toLowerCase()));

    if (isBrokerRestrictedPath && userRole === 'broker') {
      console.log('❌ BROKER ATTEMPTING TO ACCESS RESTRICTED PATH:', currentPath);
      window.history.replaceState(null, '', '/broker-dashboard');
      return;
    }

    let targetPath = '/';

    if (userRole === 'super_admin' || isSuperAdmin()) {
      targetPath = '/admin-dashboard';
    } else if (userType === 'client' || userRole === 'client') {
      targetPath = '/claims-portal';
    } else if ((userType === 'broker' || userRole === 'broker' || userRole === 'main_broker') && userRole !== 'super_admin' && userRole !== 'client') {
      targetPath = '/broker-dashboard';
    }

    if (targetPath && currentPath !== targetPath) {
      console.log(`🔀 Redirecting from ${currentPath} to ${targetPath}`);
      window.history.replaceState(null, '', targetPath);
    } else if (targetPath && currentPath === '/') {
      console.log(`🔀 Redirecting from home to ${targetPath}`);
      window.history.replaceState(null, '', targetPath);
    }
  }, [user, userType, userRole, currentPath, isSuperAdmin, onBrokerageSubdomain, onSuperAdminDomain, loading]);

  // Profile wait timeout
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

  // ─────────────────────────────────────────────────────────────
  // STEP 1: Not logged in → show sign in
  // ─────────────────────────────────────────────────────────────
  if (!user) {
    return <Login roleType={null} />;
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 2: Auth still resolving → show spinner
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    console.log('⏳ Auth still loading - showing loading screen');
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

  // ─────────────────────────────────────────────────────────────
  // STEP 3: Super admin bypass
  // ─────────────────────────────────────────────────────────────
  if (isSuperAdminEmail) {
    console.log('👑 SUPER ADMIN OVERRIDE - vickypingo@gmail.com');
    return (
      <>
        <EmergencyLogoutButton onLogout={handleForceLogout} />
        <BrokerAdminDashboard />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 4: Password setup for invited users
  // ─────────────────────────────────────────────────────────────
  if (needsPasswordSetup) {
    console.log('🔐 User needs to set password - showing SetPassword component');
    return <SetPassword />;
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 5: Client trying to access restricted routes
  // ─────────────────────────────────────────────────────────────
  if ((currentPath === '/broker-dashboard' || currentPath === '/admin-dashboard') &&
      (userType === 'client' || userRole === 'client')) {
    console.log('❌ CLIENT TRYING TO ACCESS RESTRICTED ROUTE - REDIRECTING');
    window.history.replaceState(null, '', '/claims-portal');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to your portal...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 6: Brokerage subdomain routing
  // ─────────────────────────────────────────────────────────────
  if (onBrokerageSubdomain) {
    if (userType === 'client' || userRole === 'client') {
      console.log('✅ BROKERAGE SUBDOMAIN: routing client → ClientPortal');
      return (
        <>
          <EmergencyLogoutButton onLogout={handleForceLogout} />
          <ClientPortal />
        </>
      );
    }

    if (userRole === 'broker' || userRole === 'main_broker' || userRole === 'super_admin' || userType === 'broker') {
      console.log('✅ BROKERAGE SUBDOMAIN: routing broker → BrokerAdminDashboard');
      return (
        <>
          <EmergencyLogoutButton onLogout={handleForceLogout} />
          <BrokerAdminDashboard />
        </>
      );
    }

    // No role resolved — default to client login on brokerage subdomain
    return <Login roleType="client" />;
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 7: Super admin on admin domain
  // ─────────────────────────────────────────────────────────────
  if ((isSuperAdmin() || userRole === 'super_admin') && onSuperAdminDomain) {
    console.log('👑 SUPER ADMIN DETECTED ON ADMIN DOMAIN → /admin-dashboard');
    return (
      <>
        <EmergencyLogoutButton onLogout={handleForceLogout} />
        <BrokerAdminDashboard />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 8: Client routing
  // ─────────────────────────────────────────────────────────────
  if (userType === 'client' || userRole === 'client') {
    console.log('✅ ROUTING TO: /claims-portal');
    return (
      <>
        <EmergencyLogoutButton onLogout={handleForceLogout} />
        <ClientPortal />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 9: Broker routing
  // ─────────────────────────────────────────────────────────────
  if ((userType === 'broker' || userRole === 'broker' || userRole === 'main_broker') &&
      userRole !== 'super_admin' &&
      userRole !== 'client' &&
      !isSuperAdmin()) {
    console.log('✅ ROUTING TO: /broker-dashboard');
    return (
      <>
        <EmergencyLogoutButton onLogout={handleForceLogout} />
        <BrokerAdminDashboard />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // FALLBACK: Profile not found after 3 seconds
  // ─────────────────────────────────────────────────────────────
  if (profileWaitTime >= 3) {
    console.log('⚠️ Profile not found after 3 seconds - showing welcome page');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <EmergencyLogoutButton onLogout={handleForceLogout} />
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

  // Still waiting for profile to resolve
  console.log('⚠️ Role not determined yet, showing loading state');
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

function EmergencyLogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <button
      onClick={onLogout}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-sm rounded-lg shadow-lg hover:bg-red-700 transition-colors"
      title="Clear cache and force logout"
    >
      <LogOut className="w-4 h-4" />
      Force Logout
    </button>
  );
}
