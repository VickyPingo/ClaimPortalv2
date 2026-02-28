import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Calendar, MapPin, Car, Droplet, Shield, Home, Briefcase, FileText, User } from 'lucide-react';

interface Claim {
  id: string;
  incident_type: string;
  status: string;
  created_at: string;
  claimant_name: string | null;
  claimant_phone: string | null;
  location_address: string | null;
  user_id: string | null;
  brokerage_id: string | null;
  client_name?: string;
}

interface AdminDashboardProps {
  onViewClaim: (claimId: string) => void;
  onViewClient: (clientId: string) => void;
}

export default function AdminDashboard({ onViewClaim, onViewClient }: AdminDashboardProps) {
  const { isSuperAdmin, brokerProfile } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [filteredClaims, setFilteredClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'new' | 'pending_info' | 'ready'>('all');

  useEffect(() => {
    loadClaims();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [claims, activeFilter]);

  const loadClaims = async () => {
    try {
      setLoading(true);

      console.log('🔍 AdminDashboard - Loading claims');
      console.log('  Is Super Admin:', isSuperAdmin());
      console.log('  Broker Profile:', brokerProfile);

      // If not super admin and profile not loaded yet, wait briefly
      if (!isSuperAdmin() && !brokerProfile) {
        console.log('  Profile not loaded yet, waiting...');
        setTimeout(loadClaims, 500);
        return;
      }

      let query = supabase.from('claims').select('*');

      // ACCESS CONTROL:
      // - Super Admin (role: 'super_admin'): See ALL claims across ALL brokerages
      // - Broker (role: 'broker'): ONLY see claims from their specific brokerage_id
      if (isSuperAdmin()) {
        console.log('  ⭐ SUPER ADMIN: Loading ALL claims from ALL brokerages');
      } else if (brokerProfile?.brokerage_id) {
        console.log('  🔒 BROKER: Filtering by brokerage_id:', brokerProfile.brokerage_id);
        query = query.eq('brokerage_id', brokerProfile.brokerage_id);
      } else {
        console.warn('  ⚠️ No brokerage_id found - no claims will be loaded');
        setLoading(false);
        return;
      }

      const { data: claimsData, error: claimsError } = await query.order('created_at', { ascending: false });

      if (claimsError) throw claimsError;

      console.log('  ✓ Claims loaded:', claimsData?.length || 0);

      const claimsWithClientNames = (claimsData || []).map((claim) => {
        const displayName = claim.claimant_name?.trim()
          ? claim.claimant_name
          : (claim.claimant_email?.trim() ? claim.claimant_email : 'Unknown');

        return {
          ...claim,
          client_name: displayName,
        };
      });

      setClaims(claimsWithClientNames);
    } catch (error: any) {
      console.error('Error loading claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    let filtered = [...claims];

    switch (activeFilter) {
      case 'new':
        filtered = claims.filter((c) => c.status === 'new');
        break;
      case 'pending_info':
        filtered = claims.filter((c) => c.status === 'awaiting_info');
        break;
      case 'ready':
        filtered = claims.filter((c) => c.status === 'submitted' || c.status === 'pending');
        break;
    }

    setFilteredClaims(filtered);
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

  const newCount = claims.filter((c) => c.status === 'new').length;
  const pendingInfoCount = claims.filter((c) => c.status === 'awaiting_info').length;
  const readyCount = claims.filter((c) => c.status === 'submitted' || c.status === 'pending').length;

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
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <button
              onClick={() => setActiveFilter('all')}
              className={`p-4 md:p-6 rounded-xl transition-all text-left ${
                activeFilter === 'all'
                  ? 'bg-blue-700 text-white shadow-lg'
                  : 'bg-white border-2 border-gray-200 hover:border-blue-300'
              }`}
            >
              <p className={`text-xs md:text-sm font-medium mb-1 ${activeFilter === 'all' ? 'text-blue-100' : 'text-gray-600'}`}>
                All Claims
              </p>
              <p className={`text-2xl md:text-3xl font-bold ${activeFilter === 'all' ? 'text-white' : 'text-gray-900'}`}>
                {claims.length}
              </p>
            </button>

            <button
              onClick={() => setActiveFilter('new')}
              className={`p-4 md:p-6 rounded-xl transition-all text-left ${
                activeFilter === 'new'
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-white border-2 border-gray-200 hover:border-red-300'
              }`}
            >
              <p className={`text-xs md:text-sm font-medium mb-1 ${activeFilter === 'new' ? 'text-red-100' : 'text-gray-600'}`}>
                New
              </p>
              <p className={`text-2xl md:text-3xl font-bold ${activeFilter === 'new' ? 'text-white' : 'text-gray-900'}`}>
                {newCount}
                {newCount > 0 && (
                  <span className="ml-2 text-xs md:text-sm bg-red-100 text-red-700 px-2 py-1 rounded-full">!</span>
                )}
              </p>
            </button>

            <button
              onClick={() => setActiveFilter('pending_info')}
              className={`p-4 md:p-6 rounded-xl transition-all text-left ${
                activeFilter === 'pending_info'
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'bg-white border-2 border-gray-200 hover:border-orange-300'
              }`}
            >
              <p className={`text-xs md:text-sm font-medium mb-1 ${activeFilter === 'pending_info' ? 'text-orange-100' : 'text-gray-600'}`}>
                Pending Info
              </p>
              <p className={`text-2xl md:text-3xl font-bold ${activeFilter === 'pending_info' ? 'text-white' : 'text-gray-900'}`}>
                {pendingInfoCount}
              </p>
            </button>

            <button
              onClick={() => setActiveFilter('ready')}
              className={`p-4 md:p-6 rounded-xl transition-all text-left ${
                activeFilter === 'ready'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-white border-2 border-gray-200 hover:border-purple-300'
              }`}
            >
              <p className={`text-xs md:text-sm font-medium mb-1 ${activeFilter === 'ready' ? 'text-purple-100' : 'text-gray-600'}`}>
                Ready to Submit
              </p>
              <p className={`text-2xl md:text-3xl font-bold ${activeFilter === 'ready' ? 'text-white' : 'text-gray-900'}`}>
                {readyCount}
              </p>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {activeFilter === 'all' ? 'All Claims' :
           activeFilter === 'new' ? 'New Claims' :
           activeFilter === 'pending_info' ? 'Claims Pending Info' :
           'Ready to Submit'}
        </h2>

        {filteredClaims.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No claims found</p>
          </div>
        ) : (
          <>
            {/* Desktop/Tablet Table View */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Client Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Claim Type</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Location</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredClaims.map((claim) => (
                    <tr
                      key={claim.id}
                      onClick={() => onViewClaim(claim.id)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {new Date(claim.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {claim.user_id ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewClient(claim.user_id!);
                            }}
                            className="flex items-center gap-2 text-blue-700 hover:underline font-medium"
                          >
                            <User className="w-4 h-4" />
                            {claim.client_name}
                          </button>
                        ) : (
                          <span className="text-gray-900">{claim.client_name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          {getIncidentIcon(claim.incident_type)}
                          {getIncidentLabel(claim.incident_type)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {claim.location_address ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{claim.location_address}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">No location</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(claim.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden space-y-4">
              {filteredClaims.map((claim) => (
                <div
                  key={claim.id}
                  onClick={() => onViewClaim(claim.id)}
                  className="bg-white rounded-xl shadow-md border border-gray-200 p-4 cursor-pointer active:scale-98 transition-transform"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Date</span>
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {new Date(claim.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Client Name</span>
                      {claim.user_id ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewClient(claim.user_id!);
                          }}
                          className="flex items-center gap-2 text-blue-700 hover:underline font-medium text-sm"
                        >
                          <User className="w-4 h-4" />
                          {claim.client_name}
                        </button>
                      ) : (
                        <span className="text-sm text-gray-900">{claim.client_name}</span>
                      )}
                    </div>

                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Claim Type</span>
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        {getIncidentIcon(claim.incident_type)}
                        {getIncidentLabel(claim.incident_type)}
                      </div>
                    </div>

                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Location</span>
                      <div className="text-sm text-gray-600 text-right max-w-[60%]">
                        {claim.location_address ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{claim.location_address}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">No location</span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-start pt-2 border-t border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Status</span>
                      {getStatusBadge(claim.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
