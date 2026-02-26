import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft,
  Upload,
  FileText,
  Download,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  File,
  Receipt,
  Shield,
  FileCheck
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

interface ClientDocumentsProps {
  onBack: () => void;
}

export default function ClientDocuments({ onBack }: ClientDocumentsProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('invoice');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [brokerageId, setBrokerageId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchBrokerageId();
      fetchDocuments();
    }
  }, [user]);

  const fetchBrokerageId = async () => {
    if (!user) return;

    try {
      // Try to get brokerage_id from client_profiles
      const { data: profileData } = await supabase
        .from('client_profiles')
        .select('brokerage_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileData?.brokerage_id) {
        setBrokerageId(profileData.brokerage_id);
        return;
      }

      // Fallback: try profiles table
      const { data: fallbackData } = await supabase
        .from('profiles')
        .select('brokerage_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fallbackData?.brokerage_id) {
        setBrokerageId(fallbackData.brokerage_id);
      }
    } catch (err) {
      console.error('Error fetching brokerage ID:', err);
    }
  };

  const fetchDocuments = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('client_documents')
        .select('*')
        .eq('client_user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setDocuments(data || []);
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(selectedFile.type)) {
        setError('Only PDF, JPG, PNG, and WEBP files are allowed');
        return;
      }

      // Validate file size (10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !file || !title.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      // 1. Upload file to storage
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `${timestamp}-${file.name}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Insert record into client_documents table
      const { error: insertError } = await supabase
        .from('client_documents')
        .insert({
          client_user_id: user.id,
          brokerage_id: brokerageId,
          title: title.trim(),
          doc_type: docType,
          file_path: filePath,
          notes: notes.trim() || null,
        });

      if (insertError) throw insertError;

      // Reset form
      setTitle('');
      setDocType('invoice');
      setNotes('');
      setFile(null);
      setSuccess('Document uploaded successfully');

      // Refresh documents list
      await fetchDocuments();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: ClientDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(doc.file_path, 60);

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

  const handleDelete = async (doc: ClientDocument) => {
    if (!confirm(`Are you sure you want to delete "${doc.title}"?`)) {
      return;
    }

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('client-documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('client_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      setSuccess('Document deleted successfully');
      await fetchDocuments();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error deleting document:', err);
      setError('Failed to delete document');
      setTimeout(() => setError(null), 3000);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="max-w-6xl mx-auto p-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Documents</h1>
              <p className="text-gray-600 mt-1">
                Upload and manage your invoices, receipts, and important documents
              </p>
            </div>
          </div>
        </div>

        {/* Upload Form */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <Upload className="w-6 h-6 mr-2 text-blue-700" />
            Upload New Document
          </h2>

          <form onSubmit={handleUpload} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., TV Purchase Invoice - Dec 2023"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type *
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="invoice">Invoice</option>
                  <option value="proof_of_purchase">Proof of Purchase</option>
                  <option value="warranty">Warranty</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional information about this document..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File Upload * (PDF, JPG, PNG - Max 10MB)
              </label>
              <div className="relative">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  required
                />
              </div>
              {file && (
                <p className="mt-2 text-sm text-green-600 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {file.name} selected
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-lg">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center text-green-600 bg-green-50 p-4 rounded-lg">
                <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span className="text-sm font-medium">{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !file || !title.trim()}
              className="w-full flex items-center justify-center px-6 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Document
                </>
              )}
            </button>
          </form>
        </div>

        {/* Documents List */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <FileText className="w-6 h-6 mr-2 text-blue-700" />
            My Documents ({documents.length})
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-700 animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents yet</h3>
              <p className="text-gray-600">
                Upload your first document using the form above
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Title</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Notes</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Uploaded</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition"
                    >
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
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleDownload(doc)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Download"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(doc)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
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
