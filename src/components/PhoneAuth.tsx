import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Phone, ArrowLeft, Loader2, Mail } from 'lucide-react';

interface PhoneAuthProps {
  role: 'client' | 'broker';
  brokerageId?: string;
  onBack: () => void;
}

export default function PhoneAuth({ role, brokerageId, onBack }: PhoneAuthProps) {
  const [authType, setAuthType] = useState<'phone' | 'email'>('email');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendOTP = async () => {
    setLoading(true);
    setError('');

    try {
      if (authType === 'phone') {
        const formattedPhone = phone.startsWith('+') ? phone : `+27${phone}`;
        const { error } = await supabase.auth.signInWithOtp({
          phone: formattedPhone,
        });
        if (error) throw error;
        setStep('otp');
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: email,
          options: {
            shouldCreateUser: true,
          },
        });
        if (error) throw error;
        setStep('otp');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const signInWithPassword = async () => {
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
        });

        if (error) throw error;

        if (data.user) {
          if (role === 'broker') {
            const { error: brokerError } = await supabase
              .from('broker_users')
              .upsert({
                id: data.user.id,
                brokerage_id: '00000000-0000-0000-0000-000000000001',
                phone: email,
                name: email.split('@')[0],
                role: 'admin',
              });

            if (brokerError) throw brokerError;
          } else if (role === 'client' && brokerageId) {
            const { error: clientError } = await supabase
              .from('clients')
              .upsert({
                id: data.user.id,
                brokerage_id: brokerageId,
                phone: email,
              });

            if (clientError) throw clientError;
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) throw error;

        if (data.user && role === 'client' && brokerageId) {
          const { error: clientError } = await supabase
            .from('clients')
            .upsert({
              id: data.user.id,
              brokerage_id: brokerageId,
              phone: email,
            });

          if (clientError) throw clientError;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    setLoading(true);
    setError('');

    try {
      if (authType === 'phone') {
        const formattedPhone = phone.startsWith('+') ? phone : `+27${phone}`;
        const { data, error } = await supabase.auth.verifyOtp({
          phone: formattedPhone,
          token: otp,
          type: 'sms',
        });

        if (error) throw error;

        if (data.user) {
          if (role === 'broker') {
            const { error: brokerError } = await supabase
              .from('broker_users')
              .upsert({
                id: data.user.id,
                brokerage_id: '00000000-0000-0000-0000-000000000001',
                phone: formattedPhone,
                name: formattedPhone,
                role: 'admin',
              });

            if (brokerError) throw brokerError;
          } else if (role === 'client' && brokerageId) {
            const { error: clientError } = await supabase
              .from('clients')
              .upsert({
                id: data.user.id,
                brokerage_id: brokerageId,
                phone: formattedPhone,
              });

            if (clientError) throw clientError;
          }
        }
      } else {
        const { data, error } = await supabase.auth.verifyOtp({
          email: email,
          token: otp,
          type: 'email',
        });

        if (error) throw error;

        if (data.user) {
          if (role === 'broker') {
            const { error: brokerError } = await supabase
              .from('broker_users')
              .upsert({
                id: data.user.id,
                brokerage_id: '00000000-0000-0000-0000-000000000001',
                phone: email,
                name: email.split('@')[0],
                role: 'admin',
              });

            if (brokerError) throw brokerError;
          } else if (role === 'client' && brokerageId) {
            const { error: clientError } = await supabase
              .from('clients')
              .upsert({
                id: data.user.id,
                brokerage_id: brokerageId,
                phone: email,
              });

            if (clientError) throw clientError;
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <button
          onClick={onBack}
          className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {authType === 'email' ? (
              <Mail className="w-8 h-8 text-blue-700" />
            ) : (
              <Phone className="w-8 h-8 text-blue-700" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {step === 'input' ? (isSignUp ? 'Create Account' : 'Sign-in') : 'Verify Code'}
          </h2>
          <p className="text-gray-600">
            {step === 'input'
              ? 'Enter your details to continue'
              : `Enter the 6-digit code sent to your ${authType === 'email' ? 'email' : 'phone'}`}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === 'input' ? (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setAuthType('email')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  authType === 'email'
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Mail className="w-4 h-4 inline mr-2" />
                Email
              </button>
              <button
                onClick={() => setAuthType('phone')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  authType === 'phone'
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Phone className="w-4 h-4 inline mr-2" />
                Phone
              </button>
            </div>

            {authType === 'email' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={signInWithPassword}
                  disabled={loading || !email || !password}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {isSignUp ? 'Creating Account...' : 'Signing-in...'}
                    </>
                  ) : (
                    isSignUp ? 'Create Account' : 'Sign-in'
                  )}
                </button>
                <button
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="w-full text-blue-700 py-2 text-sm hover:underline"
                >
                  {isSignUp ? 'Already have an account? Sign-in' : 'Need an account? Sign-up'}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0821234567"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={sendOTP}
                  disabled={loading || !phone}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Code'
                  )}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
              />
            </div>
            <button
              onClick={verifyOTP}
              disabled={loading || otp.length !== 6}
              className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </button>
            <button
              onClick={() => setStep('input')}
              className="w-full text-blue-700 py-2 text-sm hover:underline"
            >
              Change {authType === 'email' ? 'email' : 'phone number'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
