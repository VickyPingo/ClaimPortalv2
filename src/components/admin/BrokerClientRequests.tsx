import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  MessageSquare,
  Calendar,
  Mic,
  Loader2,
  AlertCircle,
  X,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Phone,
  Filter,
  Volume2,
  ChevronRight,
} from 'lucide-react';

interface ClientRequest {
  id: string;
  client_user_id: string;
  brokerage_id: string | null;
  request_type: string;
  subject: string;
  message: string | null;
  voice_path: string | null;
  transcript: string | null;
  meeting_requested: boolean;
  meeting_preferred_times: string | null;
  status: 'new' | 'in_progress' | 'resolved';
  created_at: string;
  client_profile?: {
    full_name?: string;
    email?: string;
  };
}

export default function BrokerClientRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<ClientRequest | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const fetchRequests = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('brokerage_id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profileData?.brokerage_id) {
        setError('Brokerage not found for your profile');
        setLoading(false);
        return;
      }

      const { data: requestsData, error: requestsError } = await supabase
        .from('client_requests')
        .select('*')
        .eq('brokerage_id', profileData.brokerage_id)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      const clientIds = [...new Set(requestsData?.map(req => req.client_user_id) || [])];

      if (clientIds.length > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', clientIds);

        if (clientsError) {
          console.error('Error fetching client profiles:', clientsError);
        }

        const requestsWithClients = requestsData?.map(req => ({
          ...req,
          client_profile: clientsData?.find(c => c.user_id === req.client_user_id) || undefined,
        })) || [];

        setRequests(requestsWithClients);
      } else {
        setRequests(requestsData || []);
      }
    } catch (err: any) {
      console.error('Error fetching requests:', err);
      setError(err.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: 'new' | 'in_progress' | 'resolved') => {
    try {
      setUpdatingStatus(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('client_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (updateError) throw updateError;

      setRequests(prev =>
        prev.map(req => (req.id === requestId ? { ...req, status: newStatus } : req))
      );

      if (selectedRequest?.id === requestId) {
        setSelectedRequest(prev => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err: any) {
      console.error('Error updating status:', err);
      setError('Failed to update status');
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const loadVoiceNote = async (voicePath: string) => {
    try {
      setLoadingAudio(true);
      setError(null);

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }

      const { data, error } = await supabase.storage
        .from('client-voicenotes')
        .createSignedUrl(voicePath, 120);

      if (error) throw error;

      if (data?.signedUrl) {
        setAudioUrl(data.signedUrl);
      }
    } catch (err: any) {
      console.error('Error loading voice note:', err);
      setError('Failed to load voice note');
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoadingAudio(false);
    }
  };

  const getClientDisplay = (req: ClientRequest) => {
    if (req.client_profile?.full_name) {
      return req.client_profile.full_name;
    }
    if (req.client_profile?.email) {
      return req.client_profile.email;
    }
    return req.client_user_id.substring(0, 8) + '...';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <AlertCircle className="w-5 h-5 text-blue-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-orange-600" />;
      case 'resolved':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      new: 'New',
      in_progress: 'In Progress',
      resolved: 'Resolved',
    };
    return labels[status] || status;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-orange-100 text-orange-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'policy_change':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'meeting_request':
        return <Calendar className="w-5 h-5 text-purple-600" />;
      case 'voice_note':
        return <Mic className="w-5 h-5 text-red-600" />;
      case 'general':
        return <MessageSquare className="w-5 h-5 text-gray-600" />;
      default:
        return <MessageSquare className="w-5 h-5 text-gray-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      policy_change: 'Policy Change',
      meeting_request: 'Meeting Request',
      voice_note: 'Voice Note',
      general: 'General Inquiry',
    };
    return labels[type] || type;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredRequests = requests.filter(req => {
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
    const matchesType = filterType === 'all' || req.request_type === filterType;
    return matchesStatus && matchesType;
  });

  const statusCounts = requests.reduce((acc, req) => {
    acc[req.status] = (acc[req.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeCounts = requests.reduce((acc, req) => {
    acc[req.request_type] = (acc[req.request_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="max-w-7xl mx-auto p-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Client Requests</h1>
          <p className="text-gray-600 mt-1">
            Manage policy changes, meeting requests, and client inquiries
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center text-red-600 bg-red-50 p-4 rounded-lg">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 mr-2 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status ({requests.length})</option>
                <option value="new">New ({statusCounts.new || 0})</option>
                <option value="in_progress">In Progress ({statusCounts.in_progress || 0})</option>
                <option value="resolved">Resolved ({statusCounts.resolved || 0})</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Request Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types ({requests.length})</option>
                <option value="policy_change">Policy Change ({typeCounts.policy_change || 0})</option>
                <option value="meeting_request">Meeting Request ({typeCounts.meeting_request || 0})</option>
                <option value="voice_note">Voice Note ({typeCounts.voice_note || 0})</option>
                <option value="general">General ({typeCounts.general || 0})</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <MessageSquare className="w-6 h-6 mr-2 text-blue-700" />
              Requests ({filteredRequests.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-700 animate-spin" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {filterStatus !== 'all' || filterType !== 'all' ? 'No matching requests' : 'No requests yet'}
              </h3>
              <p className="text-gray-600">
                {filterStatus !== 'all' || filterType !== 'all'
                  ? 'Try adjusting your filter criteria'
                  : 'Client requests will appear here once submitted'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="mt-1">{getTypeIcon(req.request_type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {req.subject}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(req.status)}`}>
                            {getStatusLabel(req.status)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            {getClientDisplay(req)}
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {formatDate(req.created_at)}
                          </div>
                          <span className="text-gray-500">
                            {getTypeLabel(req.request_type)}
                          </span>
                        </div>
                        {req.meeting_requested && (
                          <div className="mt-2 flex items-center text-sm text-purple-600">
                            <Calendar className="w-4 h-4 mr-1" />
                            Meeting requested
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getTypeIcon(selectedRequest.request_type)}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedRequest.subject}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {getTypeLabel(selectedRequest.request_type)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  if (audioUrl) {
                    URL.revokeObjectURL(audioUrl);
                    setAudioUrl(null);
                  }
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Client Information
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-900">
                    {getClientDisplay(selectedRequest)}
                  </p>
                  {selectedRequest.client_profile?.email && (
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedRequest.client_profile.email}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Submitted {formatDate(selectedRequest.created_at)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Status</h3>
                <select
                  value={selectedRequest.status}
                  onChange={(e) =>
                    handleUpdateStatus(
                      selectedRequest.id,
                      e.target.value as 'new' | 'in_progress' | 'resolved'
                    )
                  }
                  disabled={updatingStatus}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              {selectedRequest.message && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Message
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {selectedRequest.message}
                    </p>
                  </div>
                </div>
              )}

              {selectedRequest.voice_path && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <Volume2 className="w-4 h-4 mr-2" />
                    Voice Note
                  </h3>
                  {!audioUrl ? (
                    <button
                      onClick={() => loadVoiceNote(selectedRequest.voice_path!)}
                      disabled={loadingAudio}
                      className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {loadingAudio ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-5 h-5 mr-2" />
                          Load Voice Note
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <audio controls src={audioUrl} className="w-full" />
                    </div>
                  )}
                </div>
              )}

              {selectedRequest.transcript && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    Transcript
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {selectedRequest.transcript}
                    </p>
                  </div>
                </div>
              )}

              {selectedRequest.meeting_requested && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Meeting Request
                  </h3>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <p className="text-purple-900 font-medium mb-2">
                      Client has requested a meeting
                    </p>
                    {selectedRequest.meeting_preferred_times && (
                      <div>
                        <p className="text-sm text-purple-700 mb-1">
                          Preferred times:
                        </p>
                        <p className="text-sm text-purple-800 whitespace-pre-wrap">
                          {selectedRequest.meeting_preferred_times}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
