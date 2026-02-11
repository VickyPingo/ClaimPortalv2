import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminLayout from './AdminLayout';
import AdminDashboard from './AdminDashboard';
import ClientsDirectory from './ClientsDirectory';
import ClientFolder from './ClientFolder';
import ClaimMasterView from './ClaimMasterView';
import SettingsPanel from './SettingsPanel';
import BrokeragesManager from './BrokeragesManager';
import UsersManager from './UsersManager';
import InvitationManager from './InvitationManager';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import { isIndependiSubdomain, isSuperAdminDomain } from '../../utils/subdomain';

type View = 'dashboard' | 'inbox' | 'clients' | 'settings' | 'brokerages' | 'users' | 'invitations' | 'client-folder' | 'claim-view';

export default function BrokerAdminDashboard() {
  const { isSuperAdmin, userRole, user } = useAuth();

  const onIndependiSubdomain = isIndependiSubdomain();
  const onSuperAdminDomain = isSuperAdminDomain();

  // CRITICAL: On Independi subdomain, NEVER show super admin features
  // Only on super admin domain can super_admin role access admin features
  const isActualSuperAdmin = isSuperAdmin() && userRole === 'super_admin' && onSuperAdminDomain && !onIndependiSubdomain;
  const initialView = isActualSuperAdmin ? 'brokerages' : 'dashboard';

  console.log('🎯 BrokerAdminDashboard - Initialising');
  console.log('  User Email:', user?.email);
  console.log('  User Role:', userRole);
  console.log('  On Independi Subdomain:', onIndependiSubdomain);
  console.log('  On Super Admin Domain:', onSuperAdminDomain);
  console.log('  Is Super Admin:', isSuperAdmin());
  console.log('  Is Actual Super Admin:', isActualSuperAdmin);
  console.log('  Initial View:', initialView);

  const [currentView, setCurrentView] = useState<View>(initialView);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  const handleNavigate = (view: 'dashboard' | 'inbox' | 'clients' | 'settings' | 'brokerages' | 'users' | 'invitations') => {
    console.log('🧭 Navigation requested to:', view);
    console.log('  User Role:', userRole);
    console.log('  Is Super Admin:', isSuperAdmin());
    console.log('  On Independi Subdomain:', onIndependiSubdomain);

    // CRITICAL: On Independi subdomain, block ALL super admin sections
    if (onIndependiSubdomain && (view === 'settings' || view === 'brokerages' || view === 'users' || view === 'invitations')) {
      console.log('❌ Access denied - Independi subdomain blocks super admin features');
      setAccessDeniedMessage('Access Denied: This section is not available on the Independi subdomain.');
      setTimeout(() => setAccessDeniedMessage(null), 5000);
      setCurrentView('dashboard');
      return;
    }

    // CRITICAL: Only super_admin role can access these sections (and only on super admin domain)
    if ((view === 'settings' || view === 'brokerages' || view === 'users' || view === 'invitations')) {
      if (!isSuperAdmin() || userRole !== 'super_admin' || !onSuperAdminDomain) {
        console.log('❌ Access denied - user is not super_admin or not on admin domain');
        console.log('  Email:', user?.email);
        console.log('  Role:', userRole);
        console.log('  On Super Admin Domain:', onSuperAdminDomain);
        setAccessDeniedMessage('Access Denied: Only super administrators can access this section.');
        setTimeout(() => setAccessDeniedMessage(null), 5000);
        setCurrentView('dashboard');
        return;
      }
    }

    console.log('✓ Navigation allowed, switching to:', view);
    setCurrentView(view);
    setSelectedClientId(null);
    setSelectedClaimId(null);
  };

  useEffect(() => {
    console.log('📺 Current View Changed:', currentView);
    console.log('  User Role:', userRole);
    console.log('  Is Super Admin:', isSuperAdmin());
    console.log('  On Independi Subdomain:', onIndependiSubdomain);

    // CRITICAL: On Independi subdomain, block ALL super admin sections
    if (onIndependiSubdomain && (currentView === 'settings' || currentView === 'brokerages' || currentView === 'users' || currentView === 'invitations')) {
      console.log('❌ Independi subdomain blocks super admin views, redirecting to dashboard');
      setCurrentView('dashboard');
      setAccessDeniedMessage('Access Denied: Super admin features are not available on the Independi subdomain.');
      setTimeout(() => setAccessDeniedMessage(null), 5000);
      return;
    }

    // CRITICAL: Check if user is trying to access super admin sections without proper role
    if ((currentView === 'settings' || currentView === 'brokerages' || currentView === 'users' || currentView === 'invitations')) {
      if (!isSuperAdmin() || userRole !== 'super_admin' || !onSuperAdminDomain) {
        console.log('❌ Unauthorised view access detected, redirecting to dashboard');
        console.log('  Blocked view:', currentView);
        console.log('  User email:', user?.email);
        setCurrentView('dashboard');
        setAccessDeniedMessage('Access Denied: You do not have permission to access admin sections.');
        setTimeout(() => setAccessDeniedMessage(null), 5000);
      }
    }
  }, [currentView, isSuperAdmin, userRole, user, onIndependiSubdomain, onSuperAdminDomain]);

  const handleViewClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setCurrentView('client-folder');
  };

  const handleViewClaim = (claimId: string) => {
    setSelectedClaimId(claimId);
    setCurrentView('claim-view');
  };

  const handleBackFromClientFolder = () => {
    setCurrentView('clients');
    setSelectedClientId(null);
  };

  const handleBackFromClaimView = () => {
    if (selectedClientId) {
      setCurrentView('client-folder');
    } else {
      setCurrentView('dashboard');
    }
    setSelectedClaimId(null);
  };

  const renderContent = () => {
    console.log('🎬 Rendering content for view:', currentView);

    switch (currentView) {
      case 'dashboard':
        return (
          <AdminDashboard
            onViewClaim={handleViewClaim}
            onViewClient={handleViewClient}
          />
        );

      case 'inbox':
        return (
          <AdminDashboard
            onViewClaim={handleViewClaim}
            onViewClient={handleViewClient}
          />
        );

      case 'clients':
        return <ClientsDirectory onViewClient={handleViewClient} />;

      case 'client-folder':
        return selectedClientId ? (
          <ClientFolder
            clientId={selectedClientId}
            onBack={handleBackFromClientFolder}
            onViewClaim={handleViewClaim}
          />
        ) : null;

      case 'claim-view':
        return selectedClaimId ? (
          <ClaimMasterView
            claimId={selectedClaimId}
            onBack={handleBackFromClaimView}
          />
        ) : null;

      case 'brokerages':
        if (isSuperAdmin() && userRole === 'super_admin') {
          console.log('✓ Rendering BrokeragesManager for super admin');
          return <BrokeragesManager />;
        } else {
          console.log('❌ Rendering access denied for brokerages');
          console.log('  User Role:', userRole);
          return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
              <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-gray-600 mb-6">
                  You do not have permission to access organisations management. Only super administrators can view this section.
                </p>
                <button
                  onClick={() => handleNavigate('dashboard')}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          );
        }

      case 'users':
        if (isSuperAdmin() && userRole === 'super_admin') {
          console.log('✓ Rendering UsersManager for super admin');
          return <UsersManager />;
        } else {
          console.log('❌ Rendering access denied for users');
          console.log('  User Role:', userRole);
          return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
              <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-gray-600 mb-6">
                  You do not have permission to access user management. Only super administrators can view this section.
                </p>
                <button
                  onClick={() => handleNavigate('dashboard')}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          );
        }

      case 'invitations':
        if (isSuperAdmin() && userRole === 'super_admin') {
          console.log('✓ Rendering InvitationManager for super admin');
          return <InvitationManager />;
        } else {
          console.log('❌ Rendering access denied for invitations');
          console.log('  User Role:', userRole);
          return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
              <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-gray-600 mb-6">
                  You do not have permission to access invitation management. Only super administrators can view this section.
                </p>
                <button
                  onClick={() => handleNavigate('dashboard')}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          );
        }

      case 'settings':
        if (isSuperAdmin() && userRole === 'super_admin') {
          console.log('✓ Rendering SettingsPanel for super admin');
          return <SettingsPanel />;
        } else {
          console.log('❌ Rendering access denied for settings');
          console.log('  User Role:', userRole);
          return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
              <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-gray-600 mb-6">
                  You do not have permission to access admin settings. Only super administrators can view this section.
                </p>
                <button
                  onClick={() => handleNavigate('dashboard')}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          );
        }

      default:
        return null;
    }
  };

  const getLayoutView = (): 'dashboard' | 'inbox' | 'clients' | 'settings' | 'brokerages' | 'users' | 'invitations' => {
    if (currentView === 'client-folder') return 'clients';
    if (currentView === 'claim-view') return selectedClientId ? 'clients' : 'dashboard';
    return currentView as 'dashboard' | 'inbox' | 'clients' | 'settings' | 'brokerages' | 'users' | 'invitations';
  };

  return (
    <AdminLayout currentView={getLayoutView()} onNavigate={handleNavigate}>
      {accessDeniedMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-lg p-4 flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1">Access Denied</h3>
              <p className="text-sm text-red-700">{accessDeniedMessage}</p>
            </div>
            <button
              onClick={() => setAccessDeniedMessage(null)}
              className="text-red-600 hover:text-red-800 font-bold text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {renderContent()}
    </AdminLayout>
  );
}
