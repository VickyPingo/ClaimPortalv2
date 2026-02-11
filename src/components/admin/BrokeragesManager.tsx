import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Building2, Plus, Edit, Trash2, Search, Globe, Mail, Copy, Check, Link as LinkIcon, X } from 'lucide-react';

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

interface Invitation {
  id: string;
  token: string;
  brokerage_id: string;
  expires_at: string;
  used_count: number;
}

export default function BrokeragesManager() {
  const [brokerages, setBrokerages] = useState<Brokerage[]>([]);
  const [invitations, setInvitations] = useState<Record<string, Invitation>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBrokerage, setEditingBrokerage] = useState<Brokerage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    notification_email: ''
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    console.log('🏢 BrokeragesManager component mounted - fetching brokerages');
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

      if (data) {
        const inviteMap: Record<string, Invitation> = {};
        for (const brokerage of data) {
          const { data: inviteData } = await supabase
            .from('invitations')
            .select('*')
            .eq('brokerage_id', brokerage.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (inviteData) {
            inviteMap[brokerage.id] = inviteData;
          }
        }
        setInvitations(inviteMap);
      }
    } catch (error) {
      console.error('Error fetching brokerages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBrokerage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const cleanSubdomain = formData.subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');

      if (!cleanSubdomain) {
        setFormError('Subdomain can only contain letters, numbers, and hyphens');
        setFormLoading(false);
        return;
      }

      const { data: existingBrokerage } = await supabase
        .from('brokerages')
        .select('id')
        .eq('subdomain', cleanSubdomain)
        .maybeSingle();

      if (existingBrokerage) {
        setFormError('This subdomain is already taken');
        setFormLoading(false);
        return;
      }

      const { data: newBrokerage, error: brokerageError } = await supabase
        .from('brokerages')
        .insert({
          name: formData.name.trim(),
          subdomain: cleanSubdomain,
          notification_email: formData.notification_email.trim() || null,
          brand_color: '#1e40af'
        })
        .select()
        .single();

      if (brokerageError) throw brokerageError;

      const { data: newInvitation, error: inviteError } = await supabase
        .from('invitations')
        .insert({
          brokerage_id: newBrokerage.id,
          role: 'broker',
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          max_uses: null,
          is_active: true
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      await fetchBrokerages();
      setShowCreateModal(false);
      setFormData({ name: '', subdomain: '', notification_email: '' });
    } catch (error: any) {
      console.error('Error creating brokerage:', error);
      setFormError(error.message || 'Failed to create brokerage');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditBrokerage = (brokerage: Brokerage) => {
    setEditingBrokerage(brokerage);
    setFormData({
      name: brokerage.name,
      subdomain: brokerage.subdomain,
      notification_email: brokerage.notification_email || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateBrokerage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrokerage) return;

    setFormError('');
    setFormLoading(true);

    try {
      const { error } = await supabase
        .from('brokerages')
        .update({
          name: formData.name.trim(),
          notification_email: formData.notification_email.trim() || null,
        })
        .eq('id', editingBrokerage.id);

      if (error) throw error;

      await fetchBrokerages();
      setShowEditModal(false);
      setEditingBrokerage(null);
      setFormData({ name: '', subdomain: '', notification_email: '' });
    } catch (error: any) {
      console.error('Error updating brokerage:', error);
      setFormError(error.message || 'Failed to update brokerage');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteBrokerage = async (brokerageId: string, brokerageName: string) => {
    if (!confirm(`Are you sure you want to delete "${brokerageName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('brokerages')
        .delete()
        .eq('id', brokerageId);

      if (error) throw error;

      await fetchBrokerages();
    } catch (error: any) {
      console.error('Error deleting brokerage:', error);
      alert(`Failed to delete brokerage: ${error.message}`);
    }
  };

  const copyInviteLink = (brokerageId: string, token: string) => {
    const baseUrl = window.location.origin;
    const inviteLink = `${baseUrl}/signup?token=${token}&brokerId=${brokerageId}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedId(brokerageId);
    setTimeout(() => setCopiedId(null), 2000);
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
                Organisations Management
              </h1>
              <p className="text-gray-600 mt-2">
                Manage all organisation accounts and configurations
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors shadow-md"
            >
              <Plus className="w-5 h-5" />
              Add Organisation
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
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-200 relative"
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

                {invitations[brokerage.id] && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <LinkIcon className="w-4 h-4 text-green-700" />
                      <span className="text-sm font-semibold text-green-900">Active Invite Link</span>
                    </div>
                    <button
                      onClick={() => copyInviteLink(brokerage.id, invitations[brokerage.id].token)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-green-300 rounded text-sm text-green-700 hover:bg-green-50 transition-colors"
                    >
                      {copiedId === brokerage.id ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy Invite Link
                        </>
                      )}
                    </button>
                    <p className="text-xs text-green-600 mt-2">
                      Used {invitations[brokerage.id].used_count} times
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-gray-200 relative z-20">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('✏️ Edit button clicked for:', brokerage.name);
                      handleEditBrokerage(brokerage);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer font-medium"
                    style={{ position: 'relative', zIndex: 30 }}
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🗑️ Delete button clicked for:', brokerage.name);
                      handleDeleteBrokerage(brokerage.id, brokerage.name);
                    }}
                    className="px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors cursor-pointer font-medium"
                    style={{ position: 'relative', zIndex: 30 }}
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

      {showEditModal && editingBrokerage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-blue-700" />
                Edit Organisation
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingBrokerage(null);
                  setFormData({ name: '', subdomain: '', notification_email: '' });
                  setFormError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateBrokerage} className="p-6 space-y-6">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Organisation Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Independi Insurance Brokers"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Subdomain
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled
                    value={formData.subdomain}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                  <span className="text-gray-600 font-medium">.claimsportal.co.za</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Subdomain cannot be changed after creation
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Contact Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.notification_email}
                  onChange={(e) => setFormData({ ...formData, notification_email: e.target.value })}
                  placeholder="e.g., admin@independi.co.za"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This email will receive claim notifications
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingBrokerage(null);
                    setFormData({ name: '', subdomain: '', notification_email: '' });
                    setFormError('');
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-6 py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formLoading ? 'Updating...' : 'Update Brokerage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-blue-700" />
                Add New Organisation
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ name: '', subdomain: '', notification_email: '' });
                  setFormError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateBrokerage} className="p-6 space-y-6">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Organisation Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Independi Insurance Brokers"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Subdomain
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={formData.subdomain}
                    onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase() })}
                    placeholder="e.g., independi"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                  />
                  <span className="text-gray-600 font-medium">.claimsportal.co.za</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Only lowercase letters, numbers, and hyphens allowed
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Contact Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.notification_email}
                  onChange={(e) => setFormData({ ...formData, notification_email: e.target.value })}
                  placeholder="e.g., admin@independi.co.za"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This email will receive claim notifications
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" />
                  What happens next?
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• A unique invitation link will be generated automatically</li>
                  <li>• Share the link with organisation brokers to sign up</li>
                  <li>• They'll be automatically assigned to this organisation</li>
                  <li>• They will be authorised as broker users</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ name: '', subdomain: '', notification_email: '' });
                    setFormError('');
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-6 py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formLoading ? 'Creating...' : 'Create Brokerage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
