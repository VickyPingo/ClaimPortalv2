import { useState } from 'react';
import AdminLayout from './AdminLayout';
import AdminDashboard from './AdminDashboard';
import ClientsDirectory from './ClientsDirectory';
import ClientFolder from './ClientFolder';
import ClaimMasterView from './ClaimMasterView';
import BrokerSettings from '../BrokerSettings';

type View = 'dashboard' | 'inbox' | 'clients' | 'settings' | 'client-folder' | 'claim-view';

export default function BrokerAdminDashboard() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const handleNavigate = (view: 'dashboard' | 'inbox' | 'clients' | 'settings') => {
    setCurrentView(view);
    setSelectedClientId(null);
    setSelectedClaimId(null);
  };

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
        return (
          <div className="p-6">
            <BrokerSettings />
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
      {renderContent()}
    </AdminLayout>
  );
}
