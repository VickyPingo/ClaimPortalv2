import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, User, Phone, Mail, FileText, Search } from 'lucide-react';

interface Client {
  id: string;
  full_name: string;
  email: string;
  cell_number: string;
  brokerage_id: string;
  created_at: string;
  claim_count?: number;
}

interface ClientsDirectoryProps {
  onViewClient: (clientId: string) => void;
}

export default function ClientsDirectory({ onViewClient }: ClientsDirectoryProps) {
  const { isSuperAdmin, brokerProfile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredClients(clients);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredClients(
        clients.filter(
          (c) =>
            c.full_name.toLowerCase().includes(term) ||
            c.email.toLowerCase().includes(term) ||
            c.cell_number.includes(term)
        )
      );
    }
  }, [searchTerm, clients]);

  const loadClients = async () => {
    try {
      setLoading(true);

      console.log('🔍 ClientsDirectory - Loading clients');
      console.log('  Is Super Admin:', isSuperAdmin());
      console.log('  Broker Profile:', brokerProfile);

      let query = supabase.from('client_profiles').select('*');

      // ACCESS CONTROL:
      // - Super Admin (role: 'super_admin'): See ALL clients across ALL brokerages
      // - Broker (role: 'broker'): ONLY see clients from their specific brokerage_id
      if (isSuperAdmin()) {
        console.log('  ⭐ SUPER ADMIN: Loading ALL clients from ALL brokerages');
      } else if (brokerProfile?.brokerage_id) {
        console.log('  🔒 BROKER: Filtering by brokerage_id:', brokerProfile.brokerage_id);
        query = query.eq('brokerage_id', brokerProfile.brokerage_id);
      } else {
        console.warn('  ⚠️ No brokerage_id found - no clients will be loaded');
        setLoading(false);
        return;
      }

      const { data: clientsData, error: clientsError } = await query.order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      console.log('  ✓ Clients loaded:', clientsData?.length || 0);

      const clientsWithCounts = await Promise.all(
        (clientsData || []).map(async (client) => {
          const { count, error: countError } = await supabase
            .from('claims')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', client.id);

          return {
            ...client,
            claim_count: countError ? 0 : count || 0,
          };
        })
      );

      setClients(clientsWithCounts);
      setFilteredClients(clientsWithCounts);
    } catch (error: any) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Clients Directory</h1>

          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {filteredClients.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">
              {searchTerm ? 'No clients found matching your search' : 'No clients found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                onClick={() => onViewClient(client.id)}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-blue-700" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
                      {client.full_name}
                    </h3>

                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span>{client.cell_number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <span>{client.claim_count || 0} claim(s)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
