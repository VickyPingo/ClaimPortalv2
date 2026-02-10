import { useAuth } from '../contexts/AuthContext';
import Login from './Login';
import BrokerAdminDashboard from './admin/BrokerAdminDashboard';
import BrokerDashboard from './BrokerDashboard';
import ClientPortal from './ClientPortal';
import { LogOut } from 'lucide-react';

export default function HomePageRouter() {
  const { user, userType, userRole, loading, brokerProfile, clientProfile, signOut } = useAuth();

  // Create a unified profile object for easier debugging
  const profile = brokerProfile || clientProfile;

  console.log('Router detected role:', profile?.role);
  console.log('Router detected user_type:', profile?.user_type);
  console.log('Router state - userType:', userType, 'userRole:', userRole);

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

  // If not logged in, show login
  if (!user) {
    return <Login onBackToRole={() => {}} roleType={null} />;
  }

  // CRITICAL: If user is logged in but profile hasn't loaded yet, keep showing spinner
  // Do NOT default to ClientPortal until database has responded
  if (!profile && !userType) {
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

  // STEP 2: Super Admin Check - HIGHEST PRIORITY
  // Check BOTH profile.role and userRole to catch any inconsistencies
  if (profile?.role === 'super_admin' || userRole === 'super_admin') {
    console.log('!! FORCING ADMIN VIEW !!');
    console.log('✅ ROUTING TO: BrokerAdminDashboard (Super Admin)');
    return (
      <>
        <EmergencyLogoutButton />
        <BrokerAdminDashboard />
      </>
    );
  }

  // STEP 3: Broker Check
  if (profile?.user_type === 'broker' || userType === 'broker') {
    console.log('✅ ROUTING TO: BrokerDashboard (Broker)');
    return (
      <>
        <EmergencyLogoutButton />
        <BrokerDashboard onSelectClaimType={() => {}} onShowClaim={() => {}} />
      </>
    );
  }

  // STEP 4: Default - Client Portal
  console.log('✅ ROUTING TO: ClientPortal (Default)');
  return (
    <>
      <EmergencyLogoutButton />
      <ClientPortal />
    </>
  );
}
