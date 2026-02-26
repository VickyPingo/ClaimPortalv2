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
  Upload,
  X,
  Save,
  Trash2,
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
  claim?: {
    title: string;
    status: string;
  };
}

interface ClientProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface BrokerClientFileDetailProps {
  clientUserId: string;
  onBack: () => void;
}

export default function BrokerClientFileDetail({ clientUserId, onBack }: BrokerClientFileDetailProps) {
  const { user } = useAuth();
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [clientDocuments, setClientDocuments] = useState<ClientDocument[]>([]);
  const [claimDocuments, setClaimDocuments] = useState<ClaimDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDocType, setUploadDocType] = useState('id_document');
  const [uploadNotes, setUploadNotes] = useState('');

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
        .eq('brokerage_id', brokerProfile.brokerage_id)
        .maybeSingle();

      if (clientError) throw clientError;

      if (!clientData) {
        setError('Client not found or not in your brokerage');
        setLoading(false);
        return;
      }

      setClientProfile(clientData);

      const { data: clientDocsData, error: clientDocsError } = await supabase
        .from('client_documents')
        .select('*')
        .eq('client_user_id', clientUserId)
        .eq('brokerage_id', brokerProfile.brokerage_id)
        .order('created_at', { ascending: false });

      if (clientDocsError) throw clientDocsError;

      setClientDocuments(clientDocsData || []);

      const { data: claimsData, error: claimsError } = await supabase
        .from('claims')
        .select('id, title, status')
        .eq('client_user_id', clientUserId)
        .eq('brokerage_id', brokerProfile.brokerage_id);

      if (claimsError) throw claimsError;

      if (claimsData && claimsData.length > 0) {
        const claimIds = claimsData.map(c => c.id);

        const { data: claimDocsData, error: claimDocsError } = await supabase
          .from('claim_documents')
          .select('*')
          .in('claim_id', claimIds)
          .order('created_at', { ascending: false });

        if (claimDocsError) throw claimDocsError;

        const docsWithClaims = (claimDocsData || []).map(doc => ({
          ...doc,
          claim: claimsData.find(c => c.id === doc.claim_id),
        }));

        setClaimDocuments(docsWithClaims);
      }
    } catch (err: any) {
      console.error('Error fetching client data:', err);
      setError(err.message || 'Failed to load client data');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!uploadFile || !uploadTitle || !user) return;

    try {
      setUploading(true);
      setError(null);

      const { data: brokerProfile, error: brokerError } = await supabase
        .from('profiles')
        .select('brokerage_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (brokerError) throw brokerError;

      if (!brokerProfile?.brokerage_id) {
        throw new Error('Brokerage not found');
      }

      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${clientUserId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('client_documents')
        .insert({
          client_user_id: clientUserId,
          brokerage_id: brokerProfile.brokerage_id,
          title: uploadTitle,
          doc_type: uploadDocType,
          file_path: fileName,
          notes: uploadNotes || null,
        });

      if (insertError) throw insertError;

      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadDocType('id_document');
      setUploadNotes('');

      await fetchClientData();
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setError(err.message || 'Failed to upload document');
      setTimeout(() => setError(null), 3000);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadDocument = async (filePath: string, title: string, isClaimDoc: boolean) => {
    try {
      const bucket = isClaimDoc ? 'claim-documents' : 'client-documents';

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 60);

      if (error) throw error;

      if (data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = title;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      console.error('Error downloading document:', err);
      setError('Failed to download document');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      setError(null);

      const doc = clientDocuments.find(d => d.id === docId);
      if (!doc) return;

      const { error: deleteError } = await supabase
        .from('client_documents')
        .delete()
        .eq('id', docId);

      if (deleteError) throw deleteError;

      const { error: storageError } = await supabase.storage
        .from('client-documents')
        .remove([doc.file_path]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
      }

      await fetchClientData();
    } catch (err: any) {
      console.error('Error deleting document:', err);
      setError('Failed to delete document');
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

  const totalDocuments = clientDocuments.length + claimDocuments.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="max-w-7xl mx-auto p-4 py-8">
        <button
          onClick={onBack}
          className="mb-6 flex items-center text-gray-700 hover:text-blue-700 transition"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Client Folders
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
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FolderOpen className="w-8 h-8 text-blue-700" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                      {getClientDisplay()}
                    </h1>
                    {clientProfile.full_name && clientProfile.email && (
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
                <button
                  onClick={() => setUploadModalOpen(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Document
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FileText className="w-6 h-6 mr-2 text-blue-700" />
                Client Documents ({clientDocuments.length})
              </h2>
              {clientDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No client documents yet</p>
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
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span className="text-gray-500">
                                {getDocTypeLabel(doc.doc_type)}
                              </span>
                              <div className="flex items-center">
                                <Calendar className="w-4 h-4 mr-1" />
                                {formatDate(doc.created_at)}
                              </div>
                            </div>
                            {doc.notes && (
                              <p className="text-sm text-gray-600 mt-2">
                                {doc.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleDownloadDocument(doc.file_path, doc.title, false)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                            title="Download"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FileText className="w-6 h-6 mr-2 text-purple-700" />
                Claim Documents ({claimDocuments.length})
              </h2>
              {claimDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No claim documents yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {claimDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:bg-purple-50 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="mt-1">{getFileIcon(doc.doc_type)}</div>
                          <div className="flex-1 min-w-0">
                            {doc.claim && (
                              <div className="text-xs text-purple-600 font-medium mb-1">
                                Claim: {doc.claim.title}
                              </div>
                            )}
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span className="text-gray-500">
                                {getDocTypeLabel(doc.doc_type)}
                              </span>
                              <div className="flex items-center">
                                <Calendar className="w-4 h-4 mr-1" />
                                {formatDate(doc.created_at)}
                              </div>
                            </div>
                            {doc.notes && (
                              <p className="text-sm text-gray-600 mt-2">
                                {doc.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownloadDocument(doc.file_path, `claim-doc-${doc.id}`, true)}
                          className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition"
                          title="Download"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Client not found
            </h3>
            <p className="text-gray-600">
              The client may not exist or is not in your brokerage
            </p>
          </div>
        )}
      </div>

      {uploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Upload Document</h2>
              <button
                onClick={() => {
                  setUploadModalOpen(false);
                  setUploadFile(null);
                  setUploadTitle('');
                  setUploadDocType('id_document');
                  setUploadNotes('');
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Document Title *
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g., ID Document, Proof of Address"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Document Type *
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="id_document">ID Document</option>
                  <option value="proof_of_residence">Proof of Residence</option>
                  <option value="photo">Photo</option>
                  <option value="police_report">Police Report</option>
                  <option value="invoice">Invoice</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  File *
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {uploadFile && (
                  <p className="text-sm text-gray-600 mt-2">
                    Selected: {uploadFile.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Add any notes about this document..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setUploadModalOpen(false);
                  setUploadFile(null);
                  setUploadTitle('');
                  setUploadDocType('id_document');
                  setUploadNotes('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadDocument}
                disabled={uploading || !uploadFile || !uploadTitle}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
