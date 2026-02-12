import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export default function ForceSession() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'found' | 'redirecting' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state changed:', event);
      console.log('🔐 Session:', session);

      if (session?.user) {
        setSessionData(session);
        setStatus('found');
        setMessage(`Session found for: ${session.user.email || session.user.id}`);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleForceSession = async () => {
    setStatus('checking');
    setMessage('Checking for existing session from URL...');

    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Session error:', error);
        setStatus('error');
        setMessage(`Error: ${error.message}`);
        return;
      }

      if (session?.user) {
        console.log('✓ Session found:', session);
        setSessionData(session);
        setStatus('found');
        setMessage(`Session active for: ${session.user.email || session.user.id}`);
      } else {
        setStatus('error');
        setMessage('No session found. Please check the URL or try logging in again.');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setStatus('error');
      setMessage('Unexpected error occurred. Check console for details.');
    }
  };

  const handleForceRedirect = () => {
    setStatus('redirecting');
    setMessage('Redirecting to broker dashboard...');

    setTimeout(() => {
      window.location.href = 'https://claimsportal.co.za/dashboard/broker';
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Emergency Admin Grant</h1>
              <p className="text-blue-100 text-sm">Force session capture and redirect</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">Emergency Access Tool</h3>
                <p className="text-sm text-yellow-800">
                  This page captures any existing authentication session from your URL and forces a redirect to the broker dashboard.
                  Use this if the normal login flow is failing.
                </p>
              </div>
            </div>
          </div>

          {status !== 'idle' && (
            <div className={`rounded-lg p-4 border ${
              status === 'error' ? 'bg-red-50 border-red-200' :
              status === 'found' ? 'bg-green-50 border-green-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-start gap-3">
                {status === 'checking' || status === 'redirecting' ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600 flex-shrink-0 mt-0.5" />
                ) : status === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${
                    status === 'error' ? 'text-red-900' :
                    status === 'found' ? 'text-green-900' :
                    'text-blue-900'
                  }`}>
                    {message}
                  </p>
                  {sessionData && (
                    <div className="mt-2 text-xs font-mono bg-white rounded p-2 border border-gray-200">
                      <div className="text-gray-600">User ID: {sessionData.user.id}</div>
                      <div className="text-gray-600">Email: {sessionData.user.email || 'N/A'}</div>
                      <div className="text-gray-600">Phone: {sessionData.user.phone || 'N/A'}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleForceSession}
              disabled={status === 'checking' || status === 'redirecting'}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {status === 'checking' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Checking Session...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Capture Session from URL
                </>
              )}
            </button>

            {status === 'found' && (
              <button
                onClick={handleForceRedirect}
                disabled={status === 'redirecting'}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {status === 'redirecting' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    Force Redirect to Broker Dashboard
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6 text-sm text-gray-600">
            <h4 className="font-semibold text-gray-900 mb-2">How this works:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Click "Capture Session from URL" to extract your auth token</li>
              <li>The system will detect any active session from the URL hash</li>
              <li>Once found, click "Force Redirect" to go directly to the broker dashboard</li>
              <li>This bypasses all normal routing and state checks</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
