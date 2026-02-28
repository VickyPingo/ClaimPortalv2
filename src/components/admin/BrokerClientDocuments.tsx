import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  FileText,
  Download,
  Loader2,
  AlertCircle,
  Receipt,
  Shield,
  FileCheck,
  File,
  User,
  Calendar,
  Search,
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
  client_profile?: {
    full_name?: string;
    email?: string;
  };
}

export default function BrokerClientDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user]);

  const fetchDocuments = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Get broker's brokerage_id
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

      // Fetch client documents for this brokerage
      const { data: docsData, error: docsError } = await supabase
        .from('client_documents')
        .select('id, title, doc_type, notes, created_at, file_path, client_user_id, brokerage_id')
        .eq('brokerage_id', profileData.brokerage_id)
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;

      // Fetch client profiles for all unique client_user_ids
      const clientIds = [...new Set(docsData?.map(doc => doc.client_user_id) || [])];

      if (clientIds.length > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', clientIds);

        if (clientsError) {
          console.error('Error fetching client profiles:', clientsError);
        }

        // Map client data to documents
        const documentsWithClients = docsData?.map(doc => ({
          ...doc,
          client_profile: clientsData?.find(c => c.user_id === doc.client_user_id) || undefined,
        })) || [];

        setDocuments(documentsWithClients);
      } else {
        setDocuments(docsData || []);
      }
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: ClientDocument) => {
    try {
      setDownloading(doc.id);
      setError(null);

      const { data, error } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(doc.file_path, 120);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      console.error('Error downloading document:', err);
      setError('Failed to download document');
      setTimeout(() => setError(null), 3000);
    } finally {
      setDownloading(null);
    }
  };

  const getDocTypeIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return <Receipt className="w-5 h-5 text-blue-600" />;
      case 'proof_of_purchase':
        return <FileCheck className="w-5 h-5 text-green-600" />;
      case 'warranty':
        return <Shield className="w-5 h-5 text-orange-600" />;
      default:
        return <File className="w-5 h-5 text-gray-600" />;
    }
  };

  const getDocTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      invoice: 'Invoice',
      proof_of_purchase: 'Proof of Purchase',
      warranty: 'Warranty',
      other: 'Other',
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

  const getClientDisplay = (doc: ClientDocument) => {
    if (doc.client_profile?.full_name) {
      return doc.client_profile.full_name;
    }
    if (doc.client_profile?.email) {
      return doc.client_profile.email;
    }
    return doc.client_user_id.substring(0, 8) + '...';
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getClientDisplay(doc).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.notes?.toLowerCase().includes(searchTerm.toLowerCase()) || false);

    const matchesType = filterType === 'all' || doc.doc_type === filterType;

    return matchesSearch && matchesType;
  });

  const docTypeCounts = documents.reduce((acc, doc) => {
    acc[doc.doc_type] = (acc[doc.doc_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="max-w-7xl mx-auto p-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Client Documents</h1>
          <p className="text-gray-600 mt-1">
            View and download documents uploaded by your clients
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center text-red-600 bg-red-50 p-4 rounded-lg">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Documents
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by title, client, or notes..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types ({documents.length})</option>
                <option value="invoice">Invoice ({docTypeCounts.invoice || 0})</option>
                <option value="proof_of_purchase">Proof of Purchase ({docTypeCounts.proof_of_purchase || 0})</option>
                <option value="warranty">Warranty ({docTypeCounts.warranty || 0})</option>
                <option value="other">Other ({docTypeCounts.other || 0})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <FileText className="w-6 h-6 mr-2 text-blue-700" />
              Documents ({filteredDocuments.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-700 animate-spin" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchTerm || filterType !== 'all' ? 'No matching documents' : 'No documents yet'}
              </h3>
              <p className="text-gray-600">
                {searchTerm || filterType !== 'all'
                  ? 'Try adjusting your search or filter criteria'
                  : 'Client documents will appear here once uploaded'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      <div className="flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        Client
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Title</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Notes</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        Date
                      </div>
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition"
                    >
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            {getClientDisplay(doc)}
                          </span>
                          {doc.client_profile?.email && doc.client_profile.full_name && (
                            <span className="text-xs text-gray-500">{doc.client_profile.email}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          {getDocTypeIcon(doc.doc_type)}
                          <span className="ml-2 text-sm text-gray-700">
                            {getDocTypeLabel(doc.doc_type)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-medium text-gray-900">{doc.title}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">
                          {doc.notes ? (
                            doc.notes.length > 50
                              ? doc.notes.substring(0, 50) + '...'
                              : doc.notes
                          ) : (
                            <span className="text-gray-400 italic">No notes</span>
                          )}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">
                          {formatDate(doc.created_at)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={downloading === doc.id}
                            className="flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                            title="View/Download"
                          >
                            {downloading === doc.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
