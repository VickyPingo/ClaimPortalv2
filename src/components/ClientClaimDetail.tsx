import { ArrowLeft, FileText } from 'lucide-react';

interface ClientClaimDetailProps {
  claimId: string;
  onBack: () => void;
}

export default function ClientClaimDetail({ claimId, onBack }: ClientClaimDetailProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
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
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-1">Claim Details</h1>
              <p className="text-sm text-gray-600">Claim ID: {claimId}</p>
            </div>
          </div>
        </div>

        {/* Placeholder Content */}
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Claim Detail View</h3>
          <p className="text-gray-600 mb-6">
            This page will display comprehensive claim details including status, documents, timeline, and updates.
          </p>
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
