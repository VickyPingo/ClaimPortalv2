import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, Clock, LayoutDashboard } from 'lucide-react';

interface Claim {
  id: string;
  incident_type: string;
  status: string;
  created_at: string;
  user_id: string | null;
  claimant_name: string | null;
  client_name?: string;
}

export default function BrokerDashboard({
  onSelectClaimType,
  onShowClaim,
  onShowAdminDashboard,
}: {
  onSelectClaimType?: (type: string) => void;
  onShowClaim?: (claimId: string) => void;
  onShowAdminDashboard?: () => void;
}) {
  const { brokerProfile, signOut } = useAuth();
  const [recentClaims, setRecentClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentClaims();
  }, []);

  const fetchRecentClaims = async () => {
    try {
      setLoading(true);

      const { data: claimsData, error: claimsError } = await supabase
        .from('claims')
        .select('id, incident_type, status, created_at, user_id, claimant_name')
        .limit(5)
        .order('created_at', { ascending: false });

      if (claimsError) throw claimsError;

      const claimsWithClientNames = await Promise.all(
        (claimsData || []).map(async (claim) => {
          if (claim.user_id) {
            const { data: clientData } = await supabase
              .from('client_profiles')
              .select('full_name')
              .eq('id', claim.user_id)
              .maybeSingle();

            return {
              ...claim,
              client_name: clientData?.full_name || claim.claimant_name || 'Unknown',
            };
          }
          return {
            ...claim,
            client_name: claim.claimant_name || 'Unknown',
          };
        })
      );

      setRecentClaims(claimsWithClientNames);
    } catch (error) {
      console.error('Error fetching claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      submitted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      new: 'bg-red-100 text-red-800',
      awaiting_info: 'bg-orange-100 text-orange-800',
      investigating: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      resolved: 'bg-green-100 text-green-800',
    };
    return statusStyles[status] || 'bg-gray-100 text-gray-800';
  };

  const getIncidentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      motor_theft: 'Motor Vehicle Theft',
      motor_vehicle_theft: 'Motor Vehicle Theft',
      structural_damage: 'Structural Damage',
      all_risk: 'All-Risk Items',
      theft_burglary: 'Theft/Burglary',
      theft_claim: 'Theft Claim',
      motor_accident: 'Motor Accident',
      burst_geyser: 'Burst Geyser',
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                Welcome, {brokerProfile?.full_name.split(' ')[0]}
              </h1>
              <p className="text-gray-600 text-sm mt-1">View and manage insurance claims</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              {onShowAdminDashboard && (
                <button
                  onClick={onShowAdminDashboard}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-700 text-white hover:bg-blue-800 rounded-lg transition"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="text-sm font-medium">Admin Dashboard</span>
                </button>
              )}
              <button
                onClick={signOut}
                className="flex items-center justify-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Recent Claims</h2>
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : recentClaims.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No claims available to view.</p>
            </div>
          ) : (
            <>
              {/* Desktop/Tablet Table View */}
              <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Client Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Claim Type</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date Filed</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentClaims.map((claim) => (
                      <tr
                        key={claim.id}
                        onClick={() => onShowClaim?.(claim.id)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-800">
                          {claim.client_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-800">
                          {getIncidentTypeLabel(claim.incident_type)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(claim.status)}`}>
                            {claim.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(claim.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-blue-700 text-sm font-medium">
                            View
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden space-y-4">
                {recentClaims.map((claim) => (
                  <div
                    key={claim.id}
                    onClick={() => onShowClaim?.(claim.id)}
                    className="bg-white rounded-lg shadow-md border border-gray-200 p-4 cursor-pointer active:scale-98 transition-transform"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Client Name</span>
                        <span className="text-sm font-medium text-gray-800 text-right">{claim.client_name}</span>
                      </div>

                      <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Claim Type</span>
                        <span className="text-sm text-gray-800 text-right">{getIncidentTypeLabel(claim.incident_type)}</span>
                      </div>

                      <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Status</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(claim.status)}`}>
                          {claim.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Date Filed</span>
                        <span className="text-sm text-gray-600 text-right">
                          {new Date(claim.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
