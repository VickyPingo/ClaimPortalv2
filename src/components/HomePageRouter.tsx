import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Login from './Login';
import BrokerAdminDashboard from './admin/BrokerAdminDashboard';
import ClientPortal from './ClientPortal';
import { LogOut, AlertCircle } from 'lucide-react';

export default function HomePageRouter() {
  const { user, userType, userRole, loading, brokerProfile, clientProfile, signOut, isSuperAdmin } = useAuth();

  console.log('Router state - userType:', userType, 'userRole:', userRole);
  console.log('Router brokerProfile:', brokerProfile);
  console.log('Router clientProfile:', clientProfile);

  const currentPath = window.location.pathname;

  useEffect(() => {
    if (!user) return;

    // CRITICAL: Brokers should never access super admin routes
    const restrictedPaths = ['/organisations', '/users-management', '/invitations', '/admin-settings'];
    const isRestrictedPath = restrictedPaths.some(path => currentPath.toLowerCase().includes(path.toLowerCase()));

    if (isRestrictedPath && userRole === 'broker') {
      console.log('❌ BROKER ATTEMPTING TO ACCESS RESTRICTED PATH:', currentPath);
      console.log('  Redirecting to broker dashboard');
      window.history.replaceState(null, '', '/broker-dashboard');
      return;
    }

    // Determine the correct path based on role
    let targetPath = '/';

    if (isSuperAdmin() && userRole === 'super_admin') {
      targetPath = '/admin-dashboard';
    } else if (userType === 'broker' || userRole === 'broker') {
      targetPath = '/broker-dashboard';
    } else if (userType === 'client' || userRole === 'client') {
      targetPath = '/claims-portal';
    }

    // Redirect if not on the correct path
    if (currentPath !== targetPath && currentPath !== '/') {
      console.log(`🔀 Redirecting from ${currentPath} to ${targetPath}`);
      window.history.replaceState(null, '', targetPath);
    } else if (currentPath === '/') {
      window.history.replaceState(null, '', targetPath);
    }
  }, [user, userType, userRole, currentPath, isSuperAdmin]);

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
      className="fixed top-4 right-4 z-50 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 font-medium transition-colors"
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

  // STEP 2: Check if client is trying to access broker/admin routes
  if ((currentPath === '/broker-dashboard' || currentPath === '/admin-dashboard') &&
      userType === 'client' && userRole === 'client') {
    console.log('❌ CLIENT TRYING TO ACCESS RESTRICTED ROUTE - BLOCKING');
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this area. Redirecting to your claims portal...
          </p>
        </div>
        {setTimeout(() => {
          window.history.replaceState(null, '', '/claims-portal');
          window.location.reload();
        }, 2000)}
      </div>
    );
  }

  // STEP 3: SUPER ADMIN ROUTING
  if (isSuperAdmin() || userRole === 'super_admin') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👑 SUPER ADMIN DETECTED');
    console.log('✅ ROUTING TO: /admin-dashboard');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return (
      <>
        <EmergencyLogoutButton />
        <BrokerAdminDashboard />
      </>
    );
  }

  // STEP 4: BROKER ROUTING
  if (userType === 'broker' || userRole === 'broker') {
    console.log('✅ ROUTING TO: /broker-dashboard (userType: broker)');
    return (
      <>
        <EmergencyLogoutButton />
        <BrokerAdminDashboard />
      </>
    );
  }

  // STEP 5: CLIENT ROUTING
  if (userType === 'client' || userRole === 'client') {
    console.log('✅ ROUTING TO: /claims-portal (userType: client)');
    return (
      <>
        <EmergencyLogoutButton />
        <ClientPortal />
      </>
    );
  }

  // FALLBACK: Still loading or no role detected
  console.log('⚠️ UserType/Role not determined yet, showing loading state');
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Connecting to server...</p>
      </div>
    </div>
  );
}
