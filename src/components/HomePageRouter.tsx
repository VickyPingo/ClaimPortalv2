import { useAuth } from '../contexts/AuthContext';
import Login from './Login';
import BrokerAdminDashboard from './admin/BrokerAdminDashboard';
import BrokerDashboard from './BrokerDashboard';
import ClientPortal from './ClientPortal';
import { LogOut } from 'lucide-react';

export default function HomePageRouter() {
  const { user, userType, userRole, loading, brokerProfile, clientProfile, signOut } = useAuth();

  console.log('Router state - userType:', userType, 'userRole:', userRole);
  console.log('Router brokerProfile:', brokerProfile);
  console.log('Router clientProfile:', clientProfile);

  const handleForceLogout = async () => {
    console.log('🧹 FORCING COMPLETE LOGOUT AND CACHE CLEAR');

    // Clear ALL browser storage
    localStorage.clear();
    sessionStorage.clear();

    // Clear Supabase auth
    await signOut();

    // Force reload to clear any remaining state
    window.location.reload();
  };

  // STEP 1: If not logged in, show login
  if (!user) {
    return <Login roleType={null} />;
  }

  // STEP 2: SUPER ADMIN PRIORITY CHECK - Before anything else
  if (user.email === 'vickypingo@gmail.com') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👑 SUPER ADMIN EMAIL DETECTED: vickypingo@gmail.com');
    console.log('✅ ROUTING TO: BrokerAdminDashboard (Priority Override)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return <BrokerAdminDashboard />;
  }

  // Add emergency logout button (visible only when logged in)
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

  // STEP 3: ROLE-BASED ROUTING - Use userType as primary indicator

  // Check Super Admin by role (secondary check after email)
  if (brokerProfile?.role === 'super_admin') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛡️ SUPER ADMIN ROLE DETECTED');
    console.log('📋 Profile Role:', brokerProfile?.role);
    console.log('📋 User Email:', user?.email);
    console.log('✅ ROUTING TO: BrokerAdminDashboard');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return (
      <>
        <EmergencyLogoutButton />
        <BrokerAdminDashboard />
      </>
    );
  }

  // Route by userType (even if profile is still loading)
  if (userType === 'broker') {
    console.log('✅ ROUTING TO: BrokerDashboard (userType: broker)');
    console.log('📋 Broker Profile:', brokerProfile || 'Loading...');
    return (
      <>
        <EmergencyLogoutButton />
        <BrokerDashboard />
      </>
    );
  }

  if (userType === 'client') {
    console.log('✅ ROUTING TO: ClientPortal (userType: client)');
    console.log('📋 Client Profile:', clientProfile || 'Loading...');
    return (
      <>
        <EmergencyLogoutButton />
        <ClientPortal />
      </>
    );
  }

  // FALLBACK: Default to broker dashboard if userType not set yet
  console.log('⚠️ UserType not set, defaulting to BrokerDashboard');
  return (
    <>
      <EmergencyLogoutButton />
      <BrokerDashboard />
    </>
  );
}
