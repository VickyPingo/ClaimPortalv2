import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminLayout from './AdminLayout';
import AdminDashboard from './AdminDashboard';
import ClientsDirectory from './ClientsDirectory';
import ClientFolder from './ClientFolder';
import ClaimMasterView from './ClaimMasterView';
import SettingsPanel from './SettingsPanel';
import { AlertCircle, ShieldAlert } from 'lucide-react';

type View = 'dashboard' | 'inbox' | 'clients' | 'settings' | 'client-folder' | 'claim-view';

export default function BrokerAdminDashboard() {
  const { isSuperAdmin } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  const handleNavigate = (view: 'dashboard' | 'inbox' | 'clients' | 'settings') => {
    if (view === 'settings' && !isSuperAdmin()) {
      setAccessDeniedMessage('Access Denied: Only super administrators can access this section.');
      setTimeout(() => setAccessDeniedMessage(null), 5000);
      return;
    }

    setCurrentView(view);
    setSelectedClientId(null);
    setSelectedClaimId(null);
  };

  useEffect(() => {
    if (currentView === 'settings' && !isSuperAdmin()) {
      setCurrentView('dashboard');
      setAccessDeniedMessage('Access Denied: You do not have permission to access admin settings.');
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

  const getLayoutView = (): 'dashboard' | 'inbox' | 'clients' | 'settings' => {
    if (currentView === 'client-folder') return 'clients';
    if (currentView === 'claim-view') return selectedClientId ? 'clients' : 'dashboard';
    return currentView as 'dashboard' | 'inbox' | 'clients' | 'settings';
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
