import { useState } from 'react';
import { Settings, Link as LinkIcon } from 'lucide-react';
import InvitationManager from './InvitationManager';

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<'invitations'>('invitations');

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your brokerage settings and team invitations</p>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'invitations'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              Invitations
            </div>
          </button>
        </nav>
      </div>

      <div>
        {activeTab === 'invitations' && <InvitationManager />}
      </div>
    </div>
  );
}
