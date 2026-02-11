import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBrokerage } from '../contexts/BrokerageContext';
import { supabase } from '../lib/supabase';
import Login from './Login';
import Landing from './Landing';
import BrokerDashboard from './BrokerDashboard';
import ClientPortal from './ClientPortal';
import StructuralDamageForm from './StructuralDamageForm';
import AllRiskForm from './AllRiskForm';
import BurstGeyserForm from './BurstGeyserForm';
import BrokerAdminDashboard from './admin/BrokerAdminDashboard';
import ClaimDetail from './ClaimDetail';
import ProtectedRoute from './ProtectedRoute';
import { Briefcase, AlertCircle } from 'lucide-react';

export default function AuthGate() {
  const { user, userType, userRole, loading, brokerageId, isSuperAdmin } = useAuth();
  const { brokerage, loading: brokerageLoading, error: brokerageError, isPlatformDomain } = useBrokerage();
  const [showLogin, setShowLogin] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState<'client' | 'broker' | null>(null);
  const [showStructuralDamageForm, setShowStructuralDamageForm] = useState(false);
  const [showAllRiskForm, setShowAllRiskForm] = useState(false);
  const [showGeyserForm, setShowGeyserForm] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [loadingClaim, setLoadingClaim] = useState(false);

  // Log routing decisions
  useEffect(() => {
    console.log('🧭 AuthGate - Routing Decision:');
    console.log('  User ID:', user?.id);
    console.log('  User Type:', userType);
    console.log('  User Role:', userRole);
    console.log('  Is Super Admin:', isSuperAdmin());
    console.log('  Dashboard Path:', isSuperAdmin() ? '/admin/brokerages' : '/claims');
  }, [user, userType, userRole, isSuperAdmin]);

  const fetchClaimDetails = async (claimId: string) => {
    setLoadingClaim(true);
    try {
      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('id', claimId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSelectedClaim(data);
      }
    } catch (error) {
      console.error('Error fetching claim:', error);
      alert('Failed to load claim details');
    } finally {
      setLoadingClaim(false);
    }
  };

  if (brokerageLoading || loading || loadingClaim) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isPlatformDomain && (brokerageError || !brokerage)) {
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

  if (user && userType === 'broker') {
    // Super admin gets routed to admin dashboard immediately
    if (isSuperAdmin()) {
      console.log('✅ Rendering BrokerAdminDashboard for super admin');
      return (
        <ProtectedRoute allowedRoles={['broker']}>
          <BrokerAdminDashboard />
        </ProtectedRoute>
      );
    }

    // Regular broker routes
    if (selectedClaim) {
      return (
        <ProtectedRoute allowedRoles={['broker']}>
          <ClaimDetail
            claim={selectedClaim}
            onBack={() => setSelectedClaim(null)}
          />
        </ProtectedRoute>
      );
    }

    if (showStructuralDamageForm) {
      return (
        <ProtectedRoute allowedRoles={['broker']}>
          <StructuralDamageForm
            clientId={user.id}
            brokerageId={brokerageId || '00000000-0000-0000-0000-000000000001'}
            onBack={() => setShowStructuralDamageForm(false)}
          />
        </ProtectedRoute>
      );
    }

    if (showAllRiskForm) {
      return (
        <ProtectedRoute allowedRoles={['broker']}>
          <AllRiskForm
            clientId={user.id}
            brokerageId={brokerageId || '00000000-0000-0000-0000-000000000001'}
            onBack={() => setShowAllRiskForm(false)}
          />
        </ProtectedRoute>
      );
    }

    if (showGeyserForm) {
      return (
        <ProtectedRoute allowedRoles={['broker']}>
          <BurstGeyserForm
            clientId={user.id}
            brokerageId={brokerageId || '00000000-0000-0000-0000-000000000001'}
            onBack={() => setShowGeyserForm(false)}
          />
        </ProtectedRoute>
      );
    }

    console.log('→ Rendering BrokerDashboard for regular broker');
    return (
      <ProtectedRoute allowedRoles={['broker']}>
        <BrokerDashboard
          onSelectClaimType={(type) => {
            if (type === 'structural_damage') {
              setShowStructuralDamageForm(true);
            } else if (type === 'all_risk') {
              setShowAllRiskForm(true);
            } else if (type === 'burst_geyser') {
              setShowGeyserForm(true);
            }
          }}
          onShowClaim={(claimId) => fetchClaimDetails(claimId)}
        />
      </ProtectedRoute>
    );
  }

  if (user && userType === 'client') {
    return (
      <ProtectedRoute allowedRoles={['client']}>
        <ClientPortal />
      </ProtectedRoute>
    );
  }

  if (showLogin) {
    return <Login onBackToRole={() => {
      setShowLogin(false);
      setSelectedUserType(null);
    }} roleType={selectedUserType} />;
  }

  if (isPlatformDomain) {
    return (
      <Landing onSelectRole={(role) => {
        setSelectedUserType(role);
        setShowLogin(true);
      }} />
    );
  }

  if (!brokerage) {
    return null;
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
            Sign-in to access your dashboard and manage insurance claims
          </p>

          <button
            onClick={() => setShowLogin(true)}
            className="w-full max-w-sm mx-auto text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            style={{
              backgroundColor: brokerage.brand_color,
              ":hover": { filter: 'brightness(0.9)' }
            }}
          >
            Sign-in
          </button>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Secure access for brokers and clients
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
