import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Building2, Plus, Edit, Trash2, Search, Globe, Mail } from 'lucide-react';

interface Brokerage {
  id: string;
  name: string;
  subdomain: string;
  custom_domain: string | null;
  logo_url: string | null;
  brand_color: string;
  notification_email: string | null;
  created_at: string;
}

export default function BrokeragesManager() {
  const [brokerages, setBrokerages] = useState<Brokerage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchBrokerages();
  }, []);

  const fetchBrokerages = async () => {
    try {
      const { data, error } = await supabase
        .from('brokerages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBrokerages(data || []);
    } catch (error) {
      console.error('Error fetching brokerages:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBrokerages = brokerages.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.subdomain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading brokerages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Building2 className="w-8 h-8 text-blue-700" />
                Brokerages Management
              </h1>
              <p className="text-gray-600 mt-2">
                Manage all brokerage accounts and configurations
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors shadow-md"
            >
              <Plus className="w-5 h-5" />
              Add Brokerage
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search brokerages by name or subdomain..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
            />
          </div>
        </div>

        {filteredBrokerages.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm ? 'No brokerages found' : 'No brokerages yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm
                ? 'Try adjusting your search term'
                : 'Get started by creating your first brokerage'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800"
              >
                Create First Brokerage
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBrokerages.map((brokerage) => (
              <div
                key={brokerage.id}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {brokerage.logo_url ? (
                      <img
                        src={brokerage.logo_url}
                        alt={brokerage.name}
                        className="w-12 h-12 object-contain rounded"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded flex items-center justify-center"
                        style={{ backgroundColor: brokerage.brand_color }}
                      >
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">
                        {brokerage.name}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Globe className="w-3 h-3" />
                        {brokerage.subdomain}.claimsportal.co.za
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {brokerage.custom_domain && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Globe className="w-4 h-4" />
                      <span>{brokerage.custom_domain}</span>
                    </div>
                  )}
                  {brokerage.notification_email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{brokerage.notification_email}</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Created {new Date(brokerage.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    className="px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Total Brokerages
          </h3>
          <p className="text-3xl font-bold text-blue-700">{brokerages.length}</p>
          <p className="text-sm text-blue-600 mt-1">
            {searchTerm && `${filteredBrokerages.length} matching search`}
          </p>
        </div>
      </div>
    </div>
  );
}
