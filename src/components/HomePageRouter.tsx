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

  // STEP 1: Loading State - Show spinner while profile is loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile from database...</p>
        </div>
      </div>
    );
  }

  // STEP 2: If not logged in, show login
  if (!user) {
    return <Login roleType={null} />;
  }

  // STEP 3: SUPER ADMIN PRIORITY CHECK - Before anything else
  if (user.email === 'vickypingo@gmail.com') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👑 SUPER ADMIN EMAIL DETECTED: vickypingo@gmail.com');
    console.log('✅ ROUTING TO: BrokerAdminDashboard (Priority Override)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return <BrokerAdminDashboard />;
  }

  // STEP 4: If user is logged in but profile hasn't loaded yet, keep showing spinner
  if (!brokerProfile && !clientProfile) {
    console.log('⚠️ User logged in but profile is null - waiting for database response');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Fetching profile from database...</p>
        </div>
      </div>
    );
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

  // STEP 5: STRICT ROLE-BASED ROUTING - No Fallbacks

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

  // Check Broker Profile (Regular Brokers)
  if (brokerProfile && brokerProfile.role !== 'super_admin') {
    console.log('✅ ROUTING TO: BrokerDashboard (Regular Broker)');
    console.log('📋 Broker Profile:', brokerProfile);
    console.log('📋 Role:', brokerProfile.role);
    return (
      <>
        <EmergencyLogoutButton />
        <BrokerDashboard />
      </>
    );
  }

  // Check Client Profile
  if (clientProfile) {
    console.log('✅ ROUTING TO: ClientPortal (Client)');
    console.log('📋 Client Profile:', clientProfile);
    return (
      <>
        <EmergencyLogoutButton />
        <ClientPortal />
      </>
    );
  }

  // STEP 6: Profile Error State - No valid profile found
  console.error('❌ ERROR: User is logged in but has no valid profile');
  console.error('User ID:', user.id);
  console.error('User Email:', user.email);
  console.error('Broker Profile:', brokerProfile);
  console.error('Client Profile:', clientProfile);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-8">
        <EmergencyLogoutButton />
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h2>
          <p className="text-gray-600 mb-6">
            Your account exists but has no profile configured. Please contact your administrator.
          </p>
          <div className="space-y-2 text-sm text-left bg-gray-50 p-4 rounded">
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Email:</strong> {user.email}</p>
          </div>
          <button
            onClick={handleForceLogout}
            className="mt-6 w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Sign Out & Clear Data
          </button>
        </div>
      </div>
    </div>
  );
}
