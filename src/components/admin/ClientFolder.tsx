import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Loader2, User, Phone, Mail, FileText, Calendar, MapPin, Car, Droplet, Shield, Home, Briefcase, Edit2, Save, X } from 'lucide-react';

interface Claim {
  id: string;
  incident_type: string;
  status: string;
  created_at: string;
  claimant_name: string | null;
  claimant_phone: string | null;
  location_address: string | null;
}

interface ClientProfile {
  id: string;
  full_name: string;
  email: string;
  cell_number: string;
  policy_number: string | null;
  broker_notes: string;
}

interface ClientFolderProps {
  clientId: string;
  onBack: () => void;
  onViewClaim: (claimId: string) => void;
}

export default function ClientFolder({ clientId, onBack, onViewClaim }: ClientFolderProps) {
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [activeClaims, setActiveClaims] = useState<Claim[]>([]);
  const [historyClaims, setHistoryClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    cell_number: '',
    policy_number: '',
    broker_notes: '',
  });

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const loadClientData = async () => {
    try {
      setLoading(true);

      const { data: clientData, error: clientError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();

      if (clientError) throw clientError;

      if (!clientData) {
        console.error('Profile lookup failed for client:', clientId);
      }

      setClient(clientData);

      if (clientData) {
        setEditForm({
          full_name: clientData.full_name || '',
          email: clientData.email || '',
          cell_number: clientData.cell_number || '',
          policy_number: clientData.policy_number || '',
          broker_notes: clientData.broker_notes || '',
        });
      }

      console.log('🔍 Loading claims for client:', clientId);
      console.log('  Client user_id:', clientData?.user_id);
      console.log('  Client brokerage_id:', clientData?.brokerage_id);

      const { data: claimsData, error: claimsError } = await supabase
        .from('claims')
        .select('*')
        .eq('client_id', clientData?.user_id || clientId)
        .eq('brokerage_id', clientData?.brokerage_id)
        .order('created_at', { ascending: false });

      if (claimsError) throw claimsError;

      console.log('  ✓ Claims loaded:', claimsData?.length || 0);

      const active = claimsData?.filter((c) =>
        ['new', 'pending_info', 'investigating', 'submitted', 'ready_to_submit'].includes(c.status)
      ) || [];

      const history = claimsData?.filter((c) =>
        ['resolved', 'paid', 'rejected', 'closed'].includes(c.status)
      ) || [];

      setActiveClaims(active);
      setHistoryClaims(history);
    } catch (error: any) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          email: editForm.email,
          cell_number: editForm.cell_number,
          policy_number: editForm.policy_number || null,
          broker_notes: editForm.broker_notes,
        })
        .eq('id', clientId);

      if (error) throw error;

      setClient({
        ...client!,
        full_name: editForm.full_name,
        email: editForm.email,
        cell_number: editForm.cell_number,
        policy_number: editForm.policy_number || null,
        broker_notes: editForm.broker_notes,
      });

      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating client:', error);
      alert('Failed to update client details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (client) {
      setEditForm({
        full_name: client.full_name || '',
        email: client.email || '',
        cell_number: client.cell_number || '',
        policy_number: client.policy_number || '',
        broker_notes: client.broker_notes || '',
      });
    }
    setIsEditing(false);
  };

  const getIncidentIcon = (type: string) => {
    switch (type) {
      case 'motor_accident':
        return <Car className="w-5 h-5" />;
      case 'burst_geyser':
        return <Droplet className="w-5 h-5" />;
      case 'theft_claim':
        return <Shield className="w-5 h-5" />;
      case 'motor_vehicle_theft':
        return <Car className="w-5 h-5" />;
      case 'structural_damage':
        return <Home className="w-5 h-5" />;
      case 'all_risk':
        return <Briefcase className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getIncidentLabel = (type: string) => {
    const labels: Record<string, string> = {
      motor_accident: 'Motor Accident',
      burst_geyser: 'Burst Geyser',
      theft_claim: 'Theft Claim',
      motor_vehicle_theft: 'Motor Vehicle Theft',
      structural_damage: 'Structural Damage',
      all_risk: 'All-Risk',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      new: 'bg-red-100 text-red-700',
      pending: 'bg-yellow-100 text-yellow-700',
      investigating: 'bg-blue-100 text-blue-700',
      submitted: 'bg-purple-100 text-purple-700',
      awaiting_info: 'bg-orange-100 text-orange-700',
      paid: 'bg-green-100 text-green-700',
      rejected: 'bg-gray-100 text-gray-700',
      closed: 'bg-gray-100 text-gray-700',
      resolved: 'bg-green-100 text-green-700',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-700" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Client not found</p>
          <button onClick={onBack} className="text-blue-700 hover:underline">Go Back</button>
        </div>
      </div>
    );
  }

  const claimsToShow = activeTab === 'active' ? activeClaims : historyClaims;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Clients</span>
          </button>

          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="bg-blue-100 rounded-full w-20 h-20 flex items-center justify-center flex-shrink-0">
              <User className="w-10 h-10 text-blue-700" />
            </div>

            <div className="flex-1 w-full">
              {!isEditing ? (
                <>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{client.full_name}</h1>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-6 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>{client.cell_number}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span className="break-all">{client.email}</span>
                    </div>
                    {client.policy_number && (
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>Policy: {client.policy_number}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editForm.full_name}
                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={editForm.cell_number}
                        onChange={(e) => setEditForm({ ...editForm, cell_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Policy Number</label>
                      <input
                        type="text"
                        value={editForm.policy_number}
                        onChange={(e) => setEditForm({ ...editForm, policy_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              {!isEditing ? (
                <>
                  <div className="text-center sm:text-right px-4 py-2 bg-gray-50 rounded-lg sm:bg-transparent">
                    <p className="text-sm text-gray-600 mb-1">Total Claims</p>
                    <p className="text-3xl font-bold text-gray-900">{activeClaims.length + historyClaims.length}</p>
                  </div>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition whitespace-nowrap"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit Details</span>
                  </button>
                </>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                  <button
                    onClick={handleSaveChanges}
                    disabled={saving}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{saving ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {isEditing && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Broker Notes (Private)</h3>
            <textarea
              value={editForm.broker_notes}
              onChange={(e) => setEditForm({ ...editForm, broker_notes: e.target.value })}
              placeholder="Add private notes about this client..."
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <p className="text-sm text-gray-500 mt-2">These notes are only visible to brokers and will not be shared with the client.</p>
          </div>
        )}

        {!isEditing && client.broker_notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              Broker Notes
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">{client.broker_notes}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'active'
                ? 'bg-blue-700 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Active Claims ({activeClaims.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-blue-700 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            History ({historyClaims.length})
          </button>
        </div>

        {claimsToShow.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No {activeTab} claims found</p>
            <p className="text-xs text-gray-400 mt-2">User ID: {clientId}</p>
            <p className="text-xs text-gray-400">Total claims loaded: {activeClaims.length + historyClaims.length}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {claimsToShow.map((claim) => (
              <div
                key={claim.id}
                onClick={() => onViewClaim(claim.id)}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="bg-blue-50 rounded-lg p-3 text-blue-700">
                      {getIncidentIcon(claim.incident_type)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {getIncidentLabel(claim.incident_type)}
                        </h3>
                        {getStatusBadge(claim.status)}
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(claim.created_at).toLocaleDateString()}</span>
                        </div>
                        {claim.location_address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span className="truncate max-w-md">{claim.location_address}</span>
                          </div>
                        )}
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
