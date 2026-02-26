import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Folder,
  Search,
  Loader2,
  AlertCircle,
  User,
  Mail,
  FileText,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';

interface ClientProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface BrokerClientFilesProps {
  onSelectClient: (clientUserId: string) => void;
}

export default function BrokerClientFiles({ onSelectClient }: BrokerClientFilesProps) {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      fetchClients();
    }
  }, [user]);

  const fetchClients = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data: brokerProfile, error: brokerError } = await supabase
        .from('profiles')
        .select('brokerage_id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (brokerError) throw brokerError;

      if (!brokerProfile?.brokerage_id) {
        setError('Brokerage not found for your profile');
        setLoading(false);
        return;
      }

      const { data: clientsData, error: clientsError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('role', 'client')
        .eq('brokerage_id', brokerProfile.brokerage_id)
        .order('full_name', { ascending: true, nullsFirst: false });

      if (clientsError) throw clientsError;

      setClients(clientsData || []);
    } catch (err: any) {
      console.error('Error fetching clients:', err);
      setError(err.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const getClientDisplay = (client: ClientProfile) => {
    if (client.full_name) {
      return client.full_name;
    }
    if (client.email) {
      return client.email;
    }
    return client.user_id.substring(0, 8) + '...';
  };

  const getClientSubtitle = (client: ClientProfile) => {
    if (client.full_name && client.email) {
      return client.email;
    }
    return null;
  };

  const filteredClients = clients.filter((client) => {
    const searchLower = searchQuery.toLowerCase();
    const nameMatch = client.full_name?.toLowerCase().includes(searchLower);
    const emailMatch = client.email?.toLowerCase().includes(searchLower);
    return nameMatch || emailMatch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="max-w-7xl mx-auto p-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <FolderOpen className="w-8 h-8 mr-3 text-blue-700" />
            Client Files
          </h1>
          <p className="text-gray-600 mt-1">
            Browse and manage documents organized by client
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center text-red-600 bg-red-50 p-4 rounded-lg">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search clients by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Folder className="w-6 h-6 mr-2 text-blue-700" />
              Client Folders ({filteredClients.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-700 animate-spin" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12">
              <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No matching clients found' : 'No clients yet'}
              </h3>
              <p className="text-gray-600">
                {searchQuery
                  ? 'Try adjusting your search criteria'
                  : 'Client folders will appear here once clients are added to your brokerage'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClients.map((client) => (
                <button
                  key={client.user_id}
                  onClick={() => onSelectClient(client.user_id)}
                  className="group bg-gradient-to-br from-blue-50 to-white border border-gray-200 rounded-lg p-6 hover:border-blue-400 hover:shadow-lg transition text-left"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition">
                      <Folder className="w-6 h-6 text-blue-700" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-700 transition" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1 truncate">
                    {getClientDisplay(client)}
                  </h3>
                  {getClientSubtitle(client) && (
                    <div className="flex items-center text-sm text-gray-600 mb-2">
                      <Mail className="w-4 h-4 mr-1 flex-shrink-0" />
                      <span className="truncate">{getClientSubtitle(client)}</span>
                    </div>
                  )}
                  <div className="flex items-center text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
                    <FileText className="w-4 h-4 mr-1" />
                    <span>View documents</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
