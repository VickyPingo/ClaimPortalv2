import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Upload, Loader2, Palette, Mail } from 'lucide-react';

interface BrokerSettingsProps {
  onBack: () => void;
}

export default function BrokerSettings({ onBack }: BrokerSettingsProps) {
  const { brokerageId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [brokerage, setBrokerage] = useState<any>(null);
  const [brandColor, setBrandColor] = useState('#1e40af');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [notificationEmail, setNotificationEmail] = useState('');

  useEffect(() => {
    loadBrokerage();
  }, [brokerageId]);

  const loadBrokerage = async () => {
    if (!brokerageId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('brokerages')
        .select('*')
        .eq('id', brokerageId)
        .single();

      if (error) throw error;
      setBrokerage(data);
      setBrandColor(data.brand_color || '#1e40af');
      setNotificationEmail(data.notification_email || '');
    } catch (error) {
      console.error('Error loading brokerage:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!brokerageId) return;

    setSaving(true);
    try {
      let logoUrl = brokerage?.logo_url;

      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${brokerageId}/logo.${fileExt}`;
        const { data, error: uploadError } = await supabase.storage
          .from('branding')
          .upload(fileName, logoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('branding')
          .getPublicUrl(data.path);
        logoUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from('brokerages')
        .update({
          logo_url: logoUrl,
          brand_color: brandColor,
          notification_email: notificationEmail,
        })
        .eq('id', brokerageId);

      if (error) throw error;

      alert('Settings saved successfully!');
      loadBrokerage();
    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Brokerage Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            Customize your brand appearance
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              White-Labeling Options
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Upload your logo and customize brand colors
            </p>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={brokerage?.name || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Logo
              </label>
              <div className="flex items-center space-x-4">
                {brokerage?.logo_url && !logoFile && (
                  <img
                    src={brokerage.logo_url}
                    alt="Current logo"
                    className="w-24 h-24 object-contain border border-gray-300 rounded-lg"
                  />
                )}
                {logoFile && (
                  <img
                    src={URL.createObjectURL(logoFile)}
                    alt="New logo preview"
                    className="w-24 h-24 object-contain border border-gray-300 rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {logoFile
                      ? 'Change Logo'
                      : brokerage?.logo_url
                      ? 'Update Logo'
                      : 'Upload Logo'}
                  </label>
                  {logoFile && (
                    <button
                      onClick={() => setLogoFile(null)}
                      className="ml-2 text-sm text-red-600 hover:text-red-800"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Recommended: PNG or SVG, max 2MB
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Palette className="w-4 h-4 mr-2" />
                Brand Color
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-16 h-16 border border-gray-300 rounded-lg cursor-pointer"
                />
                <div>
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    placeholder="#1e40af"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    This color will be used throughout the client portal
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                Notification Email
              </label>
              <input
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="claims@yourbrokerage.com"
              />
              <p className="mt-2 text-sm text-gray-500">
                This email will receive notifications when new claims are submitted
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-blue-900 mb-2">Preview</h3>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center space-x-3 mb-3">
                    {(logoFile || brokerage?.logo_url) && (
                      <img
                        src={
                          logoFile
                            ? URL.createObjectURL(logoFile)
                            : brokerage.logo_url
                        }
                        alt="Logo preview"
                        className="w-10 h-10 object-contain"
                      />
                    )}
                    <span className="font-semibold text-gray-900">
                      {brokerage?.name}
                    </span>
                  </div>
                  <button
                    style={{ backgroundColor: brandColor }}
                    className="px-6 py-2 text-white rounded-lg font-semibold"
                  >
                    Sample Button
                  </button>
                </div>
              </div>

              <button
                onClick={saveSettings}
                disabled={saving}
                className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
