import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  User,
  Mail,
  Calendar,
  FolderOpen,
  File,
  Image as ImageIcon,
  FileSpreadsheet,
  Archive,
  Eye,
  ShoppingBag,
  AlertTriangle,
  Package,
} from 'lucide-react';

interface ClientDocument {
  id: string;
  client_user_id: string;
  brokerage_id: string | null;
  title: string;
  doc_type: string;
  file_path: string;
  notes: string | null;
  created_at: string;
}

interface ClaimDocument {
  id: string;
  claim_id: string;
  uploaded_by: string | null;
  doc_type: string;
  file_path: string;
  notes: string | null;
  created_at: string;
}

interface Claim {
  id: string;
  title: string;
  created_at: string;
  status: string;
}

interface ClientProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface GroupedClaimDocuments {
  claim: Claim;
  documents: ClaimDocument[];
}

interface BrokerClientFolderProps {
  clientUserId: string;
  onBack: () => void;
}

type TabType = 'purchases' | 'claims';

export default function BrokerClientFolder({ clientUserId, onBack }: BrokerClientFolderProps) {
  const { user } = useAuth();
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [clientDocuments, setClientDocuments] = useState<ClientDocument[]>([]);
  const [groupedClaimDocuments, setGroupedClaimDocuments] = useState<GroupedClaimDocuments[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('purchases');

  useEffect(() => {
    if (user && clientUserId) {
      fetchClientData();
    }
  }, [user, clientUserId]);

  const fetchClientData = async () => {
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

      const { data: clientData, error: clientError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('user_id', clientUserId)
        .maybeSingle();

      if (clientError) throw clientError;

      if (!clientData) {
        setError('Client not found');
        setLoading(false);
        return;
      }

      setClientProfile(clientData);

      const { data: clientDocsData, error: clientDocsError } = await supabase
        .from('client_documents')
        .select('*')
        .eq('client_user_id', clientUserId)
        .order('created_at', { ascending: false });

      if (clientDocsError) throw clientDocsError;

      setClientDocuments(clientDocsData || []);

      const { data: claimsData, error: claimsError } = await supabase
        .from('claims')
        .select('id, title, created_at, status')
        .eq('client_user_id', clientUserId)
        .order('created_at', { ascending: false });

      if (claimsError) throw claimsError;

      if (claimsData && claimsData.length > 0) {
        const claimIds = claimsData.map(c => c.id);

        const { data: claimDocsData, error: claimDocsError } = await supabase
          .from('claim_documents')
          .select('*')
          .in('claim_id', claimIds)
          .order('created_at', { ascending: false });

        if (claimDocsError) throw claimDocsError;

        const grouped: GroupedClaimDocuments[] = claimsData.map(claim => ({
          claim,
          documents: (claimDocsData || []).filter(doc => doc.claim_id === claim.id),
        })).filter(group => group.documents.length > 0);

        setGroupedClaimDocuments(grouped);
      }
    } catch (err: any) {
      console.error('Error fetching client data:', err);
      setError(err.message || 'Failed to load client data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDocument = async (filePath: string, title: string, isClaimDoc: boolean) => {
    try {
      const bucket = isClaimDoc ? 'claim-documents' : 'client-documents';

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 120);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      console.error('Error downloading document:', err);
      setError('Failed to download document');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleViewDocument = async (filePath: string, isClaimDoc: boolean) => {
    try {
      const bucket = isClaimDoc ? 'claim-documents' : 'client-documents';

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 120);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      console.error('Error viewing document:', err);
      setError('Failed to view document');
      setTimeout(() => setError(null), 3000);
    }
  };

  const getFileIcon = (docType: string) => {
    switch (docType) {
      case 'id_document':
      case 'proof_of_residence':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'photo':
        return <ImageIcon className="w-5 h-5 text-green-600" />;
      case 'spreadsheet':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
      case 'archive':
        return <Archive className="w-5 h-5 text-orange-600" />;
      case 'invoice':
        return <Package className="w-5 h-5 text-purple-600" />;
      case 'police_report':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <File className="w-5 h-5 text-gray-600" />;
    }
  };

  const getDocTypeLabel = (docType: string) => {
    const labels: Record<string, string> = {
      id_document: 'ID Document',
      proof_of_residence: 'Proof of Residence',
      photo: 'Photo',
      police_report: 'Police Report',
      invoice: 'Invoice',
      other: 'Other',
    };
    return labels[docType] || docType;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
      in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
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

  const getClientDisplay = () => {
    if (clientProfile?.full_name) {
      return clientProfile.full_name;
    }
    if (clientProfile?.email) {
      return clientProfile.email;
    }
    return clientUserId.substring(0, 8) + '...';
  };

  const totalDocuments = clientDocuments.length + groupedClaimDocuments.reduce((sum, group) => sum + group.documents.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="max-w-7xl mx-auto p-4 py-8">
        <button
          onClick={onBack}
          className="mb-6 flex items-center text-gray-700 hover:text-blue-700 transition"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Client Files
        </button>

        {error && (
          <div className="mb-6 flex items-center text-red-600 bg-red-50 p-4 rounded-lg">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-700 animate-spin" />
          </div>
        ) : clientProfile ? (
          <>
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 text-blue-700" />
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Client Files: {getClientDisplay()}
                  </h1>
                  {clientProfile.email && (
                    <div className="flex items-center text-gray-600 mb-1">
                      <Mail className="w-4 h-4 mr-2" />
                      {clientProfile.email}
                    </div>
                  )}
                  <div className="flex items-center text-sm text-gray-500">
                    <FileText className="w-4 h-4 mr-2" />
                    {totalDocuments} document{totalDocuments !== 1 ? 's' : ''} total
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('purchases')}
                    className={`flex-1 px-6 py-4 text-sm font-semibold transition ${
                      activeTab === 'purchases'
                        ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <ShoppingBag className="w-5 h-5" />
                      <span>Purchases & Invoices ({clientDocuments.length})</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('claims')}
                    className={`flex-1 px-6 py-4 text-sm font-semibold transition ${
                      activeTab === 'claims'
                        ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <AlertTriangle className="w-5 h-5" />
                      <span>Claim Uploads ({groupedClaimDocuments.reduce((sum, g) => sum + g.documents.length, 0)})</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="p-6">
                {activeTab === 'purchases' ? (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-gray-900 flex items-center">
                        <ShoppingBag className="w-6 h-6 mr-2 text-blue-700" />
                        Purchases & Invoices
                      </h2>
                    </div>

                    {clientDocuments.length === 0 ? (
                      <div className="text-center py-12">
                        <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          No documents uploaded yet
                        </h3>
                        <p className="text-gray-600">
                          Client documents will appear here once uploaded
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {clientDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3 flex-1">
                                <div className="mt-1">{getFileIcon(doc.doc_type)}</div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-gray-900 mb-1">
                                    {doc.title}
                                  </h3>
                                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                                      {getDocTypeLabel(doc.doc_type)}
                                    </span>
                                    <div className="flex items-center">
                                      <Calendar className="w-4 h-4 mr-1" />
                                      {formatDate(doc.created_at)}
                                    </div>
                                  </div>
                                  {doc.notes && (
                                    <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                                      {doc.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 ml-4">
                                <button
                                  onClick={() => handleViewDocument(doc.file_path, false)}
                                  className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                                  title="View"
                                >
                                  <Eye className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleDownloadDocument(doc.file_path, doc.title, false)}
                                  className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition"
                                  title="Download"
                                >
                                  <Download className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-gray-900 flex items-center">
                        <AlertTriangle className="w-6 h-6 mr-2 text-purple-700" />
                        Claim Uploads
                      </h2>
                    </div>

                    {groupedClaimDocuments.length === 0 ? (
                      <div className="text-center py-12">
                        <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          No claim documents yet
                        </h3>
                        <p className="text-gray-600">
                          Documents uploaded with claims will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {groupedClaimDocuments.map((group) => (
                          <div key={group.claim.id} className="border border-purple-200 rounded-lg overflow-hidden">
                            <div className="bg-purple-50 px-4 py-3 border-b border-purple-200">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="font-bold text-gray-900 flex items-center">
                                    <FileText className="w-5 h-5 mr-2 text-purple-700" />
                                    {group.claim.title}
                                  </h3>
                                  <div className="flex items-center space-x-3 mt-1">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold border ${getStatusColor(group.claim.status)}`}>
                                      {group.claim.status.replace('_', ' ').toUpperCase()}
                                    </span>
                                    <span className="text-sm text-gray-600">
                                      {formatDate(group.claim.created_at)}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-sm text-gray-600">
                                  {group.documents.length} document{group.documents.length !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                            <div className="p-4 space-y-3">
                              {group.documents.map((doc) => (
                                <div
                                  key={doc.id}
                                  className="border border-gray-200 rounded-lg p-3 hover:border-purple-300 hover:bg-purple-50 transition"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-start space-x-3 flex-1">
                                      <div className="mt-1">{getFileIcon(doc.doc_type)}</div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-3 text-sm mb-2">
                                          <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                                            {getDocTypeLabel(doc.doc_type)}
                                          </span>
                                          <div className="flex items-center text-gray-600">
                                            <Calendar className="w-4 h-4 mr-1" />
                                            {formatDate(doc.created_at)}
                                          </div>
                                        </div>
                                        {doc.notes && (
                                          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                            {doc.notes}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2 ml-4">
                                      <button
                                        onClick={() => handleViewDocument(doc.file_path, true)}
                                        className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition"
                                        title="View"
                                      >
                                        <Eye className="w-5 h-5" />
                                      </button>
                                      <button
                                        onClick={() => handleDownloadDocument(doc.file_path, `claim-${group.claim.title}`, true)}
                                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition"
                                        title="Download"
                                      >
                                        <Download className="w-5 h-5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Client not found
            </h3>
            <p className="text-gray-600">
              The client may not exist or is not accessible
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
