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

type View = 'dashboard' | 'inbox' | 'clients' | 'settings' | 'brokerages' | 'users' | 'invitations' | 'client-folder' | 'claim-view';

export default function BrokerAdminDashboard() {
  const { isSuperAdmin } = useAuth();
  const initialView = isSuperAdmin() ? 'brokerages' : 'dashboard';

  console.log('🎯 BrokerAdminDashboard - Initialising');
  console.log('  Is Super Admin:', isSuperAdmin());
  console.log('  Initial View:', initialView);

  const [currentView, setCurrentView] = useState<View>(initialView);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  const handleNavigate = (view: 'dashboard' | 'inbox' | 'clients' | 'settings' | 'brokerages' | 'users' | 'invitations') => {
    console.log('🧭 Navigation requested to:', view);

    if ((view === 'settings' || view === 'brokerages' || view === 'users' || view === 'invitations') && !isSuperAdmin()) {
      console.log('❌ Access denied - user is not super admin');
      setAccessDeniedMessage('Access Denied: Only super administrators can access this section.');
      setTimeout(() => setAccessDeniedMessage(null), 5000);
      return;
    }

    console.log('✓ Navigation allowed, switching to:', view);
    setCurrentView(view);
    setSelectedClientId(null);
    setSelectedClaimId(null);
  };

  useEffect(() => {
    console.log('📺 Current View Changed:', currentView);

    if ((currentView === 'settings' || currentView === 'brokerages' || currentView === 'users' || currentView === 'invitations') && !isSuperAdmin()) {
      console.log('❌ Unauthorised view access detected, redirecting to dashboard');
      setCurrentView('dashboard');
      setAccessDeniedMessage('Access Denied: You do not have permission to access admin sections.');
      setTimeout(() => setAccessDeniedMessage(null), 5000);
    }
  }, [currentView, isSuperAdmin]);

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
        if (isSuperAdmin()) {
          console.log('✓ Rendering BrokeragesManager for super admin');
          return <BrokeragesManager />;
        } else {
          console.log('❌ Rendering access denied for brokerages');
          return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
              <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-gray-600 mb-6">
                  You do not have permission to access brokerages management. Only super administrators can view this section.
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
        if (isSuperAdmin()) {
          console.log('✓ Rendering UsersManager for super admin');
          return <UsersManager />;
        } else {
          console.log('❌ Rendering access denied for users');
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
        if (isSuperAdmin()) {
          console.log('✓ Rendering InvitationManager for super admin');
          return <InvitationManager />;
        } else {
          console.log('❌ Rendering access denied for invitations');
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
        return isSuperAdmin() ? (
          <SettingsPanel />
        ) : (
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
