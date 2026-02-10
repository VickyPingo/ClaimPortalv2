import { useAuth } from '../contexts/AuthContext';
import { useBrokerage } from '../contexts/BrokerageContext';
import Login from './Login';
import BrokerAdminDashboard from './admin/BrokerAdminDashboard';
import BrokerDashboard from './BrokerDashboard';
import ClientPortal from './ClientPortal';
import { AlertCircle, Briefcase } from 'lucide-react';

export default function HomePageRouter() {
  const { user, userType, userRole, loading, isSuperAdmin } = useAuth();
  const { brokerage, loading: brokerageLoading, error: brokerageError, isPlatformDomain } = useBrokerage();

  console.log('🚦 HomePageRouter - Current State:');
  console.log('  User:', user?.email);
  console.log('  User Type:', userType);
  console.log('  User Role:', userRole);
  console.log('  Loading:', loading);
  console.log('  Brokerage Loading:', brokerageLoading);
  console.log('  Is Super Admin:', isSuperAdmin());

  // STEP 1: Wait for auth to load
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // STEP 2: HIGHEST PRIORITY - Super Admin Check (BEFORE ANY OTHER LOGIC)
  // This check happens IMMEDIATELY after auth loading completes
  // NOTHING can override this - not brokerage checks, not domain checks, NOTHING
  if (user && userRole === 'super_admin') {
    console.log('✅ SUPER ADMIN DETECTED - Routing to BrokerAdminDashboard');
    return <BrokerAdminDashboard />;
  }

  // STEP 3: Now wait for brokerage to load (only if not super admin)
  if (brokerageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading brokerage...</p>
        </div>
      </div>
    );
  }

  // STEP 4: Check for brokerage errors (only for non-logged-in users)
  if (!isPlatformDomain && (brokerageError || !brokerage) && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Configuration Error</h2>
          <p className="text-gray-600 mb-6">
            {brokerageError || 'Unable to load brokerage configuration for this domain.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // STEP 5: Regular Broker (non-super-admin)
  if (user && userType === 'broker' && userRole !== 'super_admin') {
    console.log('✅ BROKER DETECTED - Routing to BrokerDashboard');
    return <BrokerDashboard onSelectClaimType={() => {}} onShowClaim={() => {}} />;
  }

  // STEP 6: Client
  if (user && userType === 'client') {
    console.log('✅ CLIENT DETECTED - Routing to ClientPortal');
    return <ClientPortal />;
  }

  // STEP 7: NOT LOGGED IN - Show login screen
  if (!user) {
    console.log('❌ Not logged in, showing Login');

    if (isPlatformDomain || !brokerage) {
      return <Login onBackToRole={() => {}} roleType={null} />;
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              {brokerage.logo_url ? (
                <img
                  src={brokerage.logo_url}
                  alt={brokerage.name}
                  className="h-20 object-contain"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: brokerage.brand_color }}
                >
                  <Briefcase className="w-10 h-10 text-white" />
                </div>
              )}
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">{brokerage.name}</h1>
            <p className="text-xl text-gray-600 mb-8">Claims Portal</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Welcome</h2>
            <p className="text-gray-600 mb-8">
              Sign in to access your dashboard and manage insurance claims
            </p>

            <Login onBackToRole={() => {}} roleType={null} />
          </div>
        </div>
      </div>
    );
  }

  // FALLBACK - Show login
  console.log('→ Fallback to Login');
  return <Login onBackToRole={() => {}} roleType={null} />;
}
