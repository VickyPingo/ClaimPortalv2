import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, Plus, CreditCard as Edit, Trash2, Search, Globe, Mail, Copy, Check, Link as LinkIcon, X, Upload, Image } from 'lucide-react';

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
  const { isSuperAdmin, brokerProfile } = useAuth();
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
    slug: '',
    notification_email: '',
    broker_name: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchBrokerages();
  }, []);

  const fetchBrokerages = async () => {
    try {
      let query = supabase.from('brokerages').select('*');

      if (isSuperAdmin()) {
        // Super admin sees all
      } else if (brokerProfile?.brokerage_id) {
        query = query.eq('id', brokerProfile.brokerage_id);
      } else {
        setLoading(false);
        return;
      }

      const { data, error } = await query.order('created_at', { ascending: false });
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
          if (inviteData) inviteMap[brokerage.id] = inviteData;
        }
        setInvitations(inviteMap);
      }
    } catch (error) {
      console.error('Error fetching brokerages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) {
        setEditLogoFile(file);
        setEditLogoPreview(reader.result as string);
      } else {
        setLogoFile(file);
        setLogoPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const uploadLogo = async (file: File, slug: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${slug}/logo.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('branding')
        .upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('branding').getPublicUrl(data.path);
      return urlData.publicUrl;
    } catch (err) {
      console.error('Logo upload failed:', err);
      return null;
    }
  };

  const handleCreateBrokerage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      let slug = formData.slug.trim();
      if (!slug && formData.name) {
        slug = formData.name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
      }

      if (!slug) { setFormError('Subdomain is required'); setFormLoading(false); return; }

      const slugPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
      if (!slugPattern.test(slug)) {
        setFormError('Invalid subdomain format. Use lowercase letters, numbers, and hyphens only');
        setFormLoading(false);
        return;
      }

      const { data: existingBrokerage } = await supabase
        .from('brokerages').select('id').eq('slug', slug).maybeSingle();
      if (existingBrokerage) {
        setFormError('This subdomain is already taken');
        setFormLoading(false);
        return;
      }

      // Upload logo first if provided
      let logoUrl: string | null = null;
      if (logoFile) {
        logoUrl = await uploadLogo(logoFile, slug);
      }

      const { data: newBrokerage, error: brokerageError } = await supabase
        .from('brokerages')
        .insert({
          name: formData.name.trim(),
          slug,
          signup_code: slug,
          subdomain: slug,
          notification_email: formData.notification_email.trim() || null,
          brand_color: '#1e40af',
          logo_url: logoUrl,
        })
        .select()
        .single();

      if (brokerageError) throw brokerageError;

      const invitationToken = crypto.randomUUID();
      const { data: newInvitation, error: inviteError } = await supabase
        .from('invitations')
        .insert({
          email: formData.notification_email.trim() || 'admin@example.com',
          brokerage_id: newBrokerage.id,
          role: 'broker',
          token: invitationToken,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          max_uses: null,
          is_active: true,
          used_count: 0,
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      if (newInvitation && formData.notification_email) {
        try {
          const emailResponse = await fetch('/.netlify/functions/send-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.notification_email.trim(),
              role: 'broker',
              brokerageId: newBrokerage.id,
              brokerName: formData.broker_name.trim(),
            }),
          });
          if (!emailResponse.ok) {
            const emailResult = await emailResponse.json();
            alert(`Brokerage created successfully, but activation email failed.\n\nError: ${emailResult.error}`);
          }
        } catch (emailErr: any) {
          console.error('Activation email error:', emailErr);
        }
      }

      await fetchBrokerages();
      setShowCreateModal(false);
      setFormData({ name: '', slug: '', notification_email: '', broker_name: '' });
      setLogoFile(null);
      setLogoPreview(null);
    } catch (error: any) {
      setFormError(error.message || 'Failed to create brokerage');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditBrokerage = (brokerage: Brokerage) => {
    setEditingBrokerage(brokerage);
    setFormData({
      name: brokerage.name,
      slug: brokerage.subdomain,
      notification_email: brokerage.notification_email || '',
      broker_name: '',
    });
    setEditLogoFile(null);
    setEditLogoPreview(brokerage.logo_url || null);
    setShowEditModal(true);
  };

  const handleUpdateBrokerage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrokerage) return;
    setFormError('');
    setFormLoading(true);

    try {
      let logoUrl = editingBrokerage.logo_url;

      if (editLogoFile) {
        logoUrl = await uploadLogo(editLogoFile, editingBrokerage.subdomain);
      }

      const { error } = await supabase
        .from('brokerages')
        .update({
          name: formData.name.trim(),
          notification_email: formData.notification_email.trim() || null,
          logo_url: logoUrl,
        })
        .eq('id', editingBrokerage.id);

      if (error) throw error;

      await fetchBrokerages();
      setShowEditModal(false);
      setEditingBrokerage(null);
      setEditLogoFile(null);
      setEditLogoPreview(null);
      setFormData({ name: '', slug: '', notification_email: '', broker_name: '' });
    } catch (error: any) {
      setFormError(error.message || 'Failed to update brokerage');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteBrokerage = async (brokerageId: string, brokerageName: string) => {
    if (!confirm(`Are you sure you want to delete "${brokerageName}"? This action cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('brokerages').delete().eq('id', brokerageId);
      if (error) throw error;
      await fetchBrokerages();
    } catch (error: any) {
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
          <p className="text-gray-600">Connecting to server...</p>
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
              <p className="text-gray-600 mt-2">Manage all organisation accounts and configurations</p>
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
              placeholder="Search brokerages by name or domain..."
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
              {searchTerm ? 'Try adjusting your search term' : 'Get started by creating your first brokerage'}
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
                      <h3 className="font-bold text-gray-900 text-lg">{brokerage.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Globe className="w-3 h-3" />
                        {brokerage.subdomain}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
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
                        <><Check className="w-4 h-4" /> Copied!</>
                      ) : (
                        <><Copy className="w-4 h-4" /> Copy Invite Link</>
                      )}
                    </button>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-gray-200 relative z-20">
                  <button
                    type="button"
                    onClick={() => handleEditBrokerage(brokerage)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBrokerage(brokerage.id, brokerage.name)}
                    className="px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition-colors font-medium"
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
        </div>
      </div>

      {/* ─── EDIT MODAL ─── */}
      {showEditModal && editingBrokerage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-blue-700" />
                Edit Organisation
              </h2>
              <button onClick={() => { setShowEditModal(false); setEditingBrokerage(null); setFormError(''); }}
                className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateBrokerage} className="p-6 space-y-6">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{formError}</div>
              )}

              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Organisation Logo
                </label>
                <div className="flex items-center gap-4">
                  {editLogoPreview ? (
                    <img src={editLogoPreview} alt="Logo preview" className="h-16 object-contain border border-gray-200 rounded-lg p-1" />
                  ) : (
                    <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                      <Image className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoChange(e, true)}
                      className="hidden"
                      id="edit-logo-upload"
                    />
                    <label
                      htmlFor="edit-logo-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      {editLogoFile ? 'Change Logo' : editingBrokerage.logo_url ? 'Update Logo' : 'Upload Logo'}
                    </label>
                    <p className="text-xs text-gray-500 mt-1">PNG or SVG recommended</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Organisation Name</label>
                <input type="text" required value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Subdomain</label>
                <div className="flex items-center gap-2">
                  <input type="text" disabled value={formData.slug}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                  <span className="text-gray-500 text-sm whitespace-nowrap">.claimsportal.co.za</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Subdomain cannot be changed after creation</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Email</label>
                <input type="email" value={formData.notification_email}
                  onChange={(e) => setFormData({ ...formData, notification_email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button"
                  onClick={() => { setShowEditModal(false); setEditingBrokerage(null); setFormError(''); }}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" disabled={formLoading}
                  className="flex-1 px-6 py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CREATE MODAL ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-blue-700" />
                Add New Organisation
              </h2>
              <button
                onClick={() => { setShowCreateModal(false); setFormData({ name: '', slug: '', notification_email: '', broker_name: '' }); setLogoFile(null); setLogoPreview(null); setFormError(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateBrokerage} className="p-6 space-y-6">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{formError}</div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Organisation Name *</label>
                <input type="text" required value={formData.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setFormData({ ...formData, name: newName });
                    if (!formData.slug) {
                      const autoSlug = newName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
                      setFormData({ ...formData, name: newName, slug: autoSlug });
                    }
                  }}
                  placeholder="e.g., Timo Marketing"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Main Broker Name *</label>
                <input type="text" required value={formData.broker_name}
                  onChange={(e) => setFormData({ ...formData, broker_name: e.target.value })}
                  placeholder="e.g., John Smith"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">The primary broker who will manage this organisation</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Subdomain (slug)</label>
                <div className="flex items-center gap-2">
                  <input type="text" required value={formData.slug}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
                      setFormData({ ...formData, slug: value });
                    }}
                    placeholder="e.g., independi"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                  />
                  <span className="text-gray-500 text-sm whitespace-nowrap">.claimsportal.co.za</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This will create: https://{formData.slug || 'subdomain'}.claimsportal.co.za
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Email</label>
                <input type="email" required value={formData.notification_email}
                  onChange={(e) => setFormData({ ...formData, notification_email: e.target.value })}
                  placeholder="e.g., admin@independi.co.za"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">This email will receive claim notifications</p>
              </div>

              {/* ─── LOGO UPLOAD ─── */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Organisation Logo <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <div className="relative">
                      <img src={logoPreview} alt="Logo preview" className="h-16 object-contain border border-gray-200 rounded-lg p-1" />
                      <button
                        type="button"
                        onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                      <Image className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoChange(e, false)}
                      className="hidden"
                      id="create-logo-upload"
                    />
                    <label
                      htmlFor="create-logo-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      {logoFile ? 'Change Logo' : 'Upload Logo'}
                    </label>
                    <p className="text-xs text-gray-500 mt-1">PNG or SVG, shown throughout the client app</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  What happens next?
                </h3>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold mt-0.5">1.</span>
                    <span>An activation email will be sent to <strong>{formData.notification_email || 'the contact email'}</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold mt-0.5">2.</span>
                    <span>The broker clicks the link to set their password</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold mt-0.5">3.</span>
                    <span>They log in at <strong>{formData.slug ? `${formData.slug}.claimsportal.co.za` : 'their subdomain'}</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold mt-0.5">4.</span>
                    <span>Their logo shows automatically on the login screen and throughout the app</span>
                  </li>
                </ul>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button"
                  onClick={() => { setShowCreateModal(false); setFormData({ name: '', slug: '', notification_email: '', broker_name: '' }); setLogoFile(null); setLogoPreview(null); setFormError(''); }}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" disabled={formLoading}
                  className="flex-1 px-6 py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50"
                >
                  {formLoading ? 'Authorising...' : 'Authorise Organisation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
