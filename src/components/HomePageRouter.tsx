import { useAuth } from '../contexts/AuthContext';
import Login from './Login';
import BrokerAdminDashboard from './admin/BrokerAdminDashboard';
import BrokerDashboard from './BrokerDashboard';
import ClientPortal from './ClientPortal';

export default function HomePageRouter() {
  const { user, userType, userRole, loading, brokerProfile, clientProfile } = useAuth();

  // Create a unified profile object for easier debugging
  const profile = brokerProfile || clientProfile;

  console.log('Router detected role:', profile?.role);
  console.log('Router detected user_type:', profile?.user_type);
  console.log('Router state - userType:', userType, 'userRole:', userRole);

  // STEP 1: Loading State - Show spinner while profile is loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show login
  if (!user) {
    return <Login onBackToRole={() => {}} roleType={null} />;
  }

  // STEP 2: Super Admin Check - HIGHEST PRIORITY
  if (userRole === 'super_admin') {
    console.log('✅ ROUTING TO: BrokerAdminDashboard (Super Admin)');
    return <BrokerAdminDashboard />;
  }

  // STEP 3: Broker Check
  if (userType === 'broker') {
    console.log('✅ ROUTING TO: BrokerDashboard (Broker)');
    return <BrokerDashboard onSelectClaimType={() => {}} onShowClaim={() => {}} />;
  }

  // STEP 4: Default - Client Portal
  console.log('✅ ROUTING TO: ClientPortal (Default)');
  return <ClientPortal />;
}
