import { Shield, Building2 } from 'lucide-react';

interface LandingProps {
  onSelectRole: (role: 'client' | 'broker') => void;
}

export default function Landing({ onSelectRole }: LandingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-16 h-16 text-blue-700" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Claims Portal
          </h1>
          <p className="text-lg text-gray-600">
            Professional insurance claims management
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => onSelectRole('client')}
            className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 text-left"
          >
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-blue-700" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              File a Claim
            </h2>
            <p className="text-gray-600 mb-4">
              Submit a new insurance claim with photos, videos, and details
            </p>
            <div className="text-blue-700 font-semibold flex items-center">
              Get Started
              <span className="ml-2">→</span>
            </div>
          </button>

          <button
            onClick={() => onSelectRole('broker')}
            className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 text-left"
          >
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-blue-700" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Broker Login
            </h2>
            <p className="text-gray-600 mb-4">
              Access your dashboard to manage claims and view analytics
            </p>
            <div className="text-blue-700 font-semibold flex items-center">
              Sign In
              <span className="ml-2">→</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
