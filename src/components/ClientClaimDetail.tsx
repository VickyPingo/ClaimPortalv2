import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft,
  FileText,
  Upload,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  Calendar,
  Lock,
  File,
  Image as ImageIcon,
  FileCheck,
  X,
} from 'lucide-react';

interface ClientClaimDetailProps {
  claimId: string;
  onBack: () => void;
}

interface Claim {
  id: string;
  incident_type: string;
  status: string;
  created_at: string;
  claimant_name?: string;
  policy_number?: string;
  user_id: string;
  brokerage_id: string;
}

interface ClaimDocument {
  id: string;
  claim_id: string;
  uploaded_by: string;
  doc_type: string;
  file_path: string;
  notes: string | null;
  created_at: string;
}

export default function ClientClaimDetail({ claimId, onBack }: ClientClaimDetailProps) {
  const { user } = useAuth();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [docType, setDocType] = useState<string>('photo');
  const [notes, setNotes] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadClaimAndDocuments();
  }, [claimId, user]);

  const loadClaimAndDocuments = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      setUnauthorized(false);

      const { data: claimData, error: claimError } = await supabase
        .from('claims')
        .select('*')
        .eq('id', claimId)
        .maybeSingle();

      if (claimError) throw claimError;

      if (!claimData) {
        setError('Claim not found');
        return;
      }

      if (claimData.user_id !== user.id) {
        setUnauthorized(true);
        return;
      }

      setClaim(claimData);

      const { data: docsData, error: docsError } = await supabase
        .from('claim_documents')
        .select('*')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;

      setDocuments(docsData || []);
    } catch (err: any) {
      console.error('Error loading claim:', err);
      setError(err.message || 'Failed to load claim details');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        showToast('File size must be less than 10MB', 'error');
        return;
      }

      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        showToast('Only PDF, JPEG, and PNG files are allowed', 'error');
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user || !claim) return;

    try {
      setUploading(true);
      setError(null);

      const timestamp = Date.now();
      const filePath = `${user.id}/${claimId}/${timestamp}-${selectedFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from('claim-documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('claim_documents').insert({
        claim_id: claimId,
        uploaded_by: user.id,
        doc_type: docType,
        file_path: filePath,
        notes: notes.trim() || null,
      });

      if (insertError) throw insertError;

      showToast('Document uploaded successfully', 'success');
      setSelectedFile(null);
      setNotes('');
      setDocType('photo');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await loadClaimAndDocuments();
    } catch (err: any) {
      console.error('Error uploading document:', err);
      showToast(err.message || 'Failed to upload document', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: ClaimDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('claim-documents')
        .createSignedUrl(doc.file_path, 60);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      console.error('Error downloading document:', err);
      showToast(err.message || 'Failed to download document', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const getIncidentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      motor_accident: 'Motor Accident',
      burst_geyser: 'Burst Geyser',
      theft: 'Theft',
      motor_vehicle_theft: 'Motor Vehicle Theft',
      structural_damage: 'Structural Damage',
      all_risk: 'All Risk',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-orange-100 text-orange-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      closed: 'bg-gray-100 text-gray-800',
    };

    const statusLabels: Record<string, string> = {
      new: 'New',
      pending: 'Pending',
      in_progress: 'In Progress',
      approved: 'Approved',
      rejected: 'Rejected',
      closed: 'Closed',
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-semibold ${
          statusColors[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {statusLabels[status] || status}
      </span>
    );
  };

  const getDocTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      police_report: 'Police Report',
      invoice: 'Invoice',
      photo: 'Photo',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const getDocTypeIcon = (type: string) => {
    switch (type) {
      case 'police_report':
        return <FileCheck className="w-5 h-5 text-blue-600" />;
      case 'invoice':
        return <FileText className="w-5 h-5 text-green-600" />;
      case 'photo':
        return <ImageIcon className="w-5 h-5 text-orange-600" />;
      default:
        return <File className="w-5 h-5 text-gray-600" />;
    }
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

  const isClaimLocked = claim && (claim.status === 'closed' || claim.status === 'approved');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading claim details...</p>
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h1 className="text-3xl font-bold text-gray-800">Not Authorized</h1>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-red-700 mb-6">
              You do not have permission to view this claim.
            </p>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
            >
              Back to Claims List
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h1 className="text-3xl font-bold text-gray-800">Error</h1>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-red-900 mb-2">
              {error || 'Claim not found'}
            </h3>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Back to Claims List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 hover:bg-white/20 rounded p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to claims list"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-800 mb-1">Claim Details</h1>
              <p className="text-sm text-gray-600">Claim ID: {claimId}</p>
            </div>
            {getStatusBadge(claim.status)}
          </div>
        </div>

        {/* Claim Summary */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Claim Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Claim Type</p>
              <p className="font-semibold text-gray-900">
                {getIncidentTypeLabel(claim.incident_type)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Policy Number</p>
              <p className="font-semibold text-gray-900">{claim.policy_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Claimant Name</p>
              <p className="font-semibold text-gray-900">{claim.claimant_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date Submitted</p>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <p className="font-semibold text-gray-900">{formatDate(claim.created_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lock Message */}
        {isClaimLocked && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <Lock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-900">This claim is locked</p>
              <p className="text-sm text-yellow-800">
                Contact your broker to make changes or upload additional documents.
              </p>
            </div>
          </div>
        )}

        {/* Document Upload Panel */}
        {!isClaimLocked && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Document</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type *
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="photo">Photo</option>
                  <option value="police_report">Police Report</option>
                  <option value="invoice">Invoice</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this document..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File (PDF, JPEG, PNG - Max 10MB) *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {selectedFile && (
                  <p className="text-sm text-gray-600 mt-2">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)}{' '}
                    MB)
                  </p>
                )}
              </div>

              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Upload Document
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Document List */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Documents ({documents.length})
          </h2>

          {documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No documents yet</h3>
              <p className="text-gray-600">
                {isClaimLocked
                  ? 'No documents have been uploaded for this claim.'
                  : 'Upload your first document using the form above.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">{getDocTypeIcon(doc.doc_type)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {getDocTypeLabel(doc.doc_type)}
                        </h3>
                        <p className="text-sm text-gray-600">{formatDate(doc.created_at)}</p>
                      </div>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex-shrink-0"
                      >
                        <Download className="w-4 h-4" />
                        View
                      </button>
                    </div>

                    {doc.notes && (
                      <p className="text-sm text-gray-700 bg-gray-100 rounded p-3 mt-2">
                        {doc.notes}
                      </p>
                    )}

                    <p className="text-xs text-gray-500 mt-2">
                      {doc.file_path.split('/').pop()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
