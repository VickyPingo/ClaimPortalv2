import { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  Phone,
  Car,
  Image as ImageIcon,
  Video,
  Mic,
  Loader2,
  Download,
  Save,
  FileText,
  Mail,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface ClaimDetailProps {
  claim: any;
  onBack: () => void;
}

export default function ClaimDetail({ claim, onBack }: ClaimDetailProps) {
  const [status, setStatus] = useState(claim.status);
  const [updating, setUpdating] = useState(false);
  const [locationAddress, setLocationAddress] = useState(claim.location_address || '');
  const [editingAddress, setEditingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('claims')
        .update({ status: newStatus })
        .eq('id', claim.id);

      if (error) throw error;
      setStatus(newStatus);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const saveAddress = async () => {
    setSavingAddress(true);
    try {
      const { error } = await supabase
        .from('claims')
        .update({ location_address: locationAddress })
        .eq('id', claim.id);

      if (error) throw error;
      setEditingAddress(false);
    } catch (error) {
      console.error('Error updating address:', error);
      alert('Failed to update address');
    } finally {
      setSavingAddress(false);
    }
  };

  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file');
    }
  };

  const sendEmailNotification = async () => {
    setSendingEmail(true);
    setEmailSent(false);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-claim-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            claimId: claim.id,
            brokerageId: claim.brokerage_id,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        setEmailSent(true);
        setTimeout(() => setEmailSent(false), 5000);
      } else {
        alert(result.message || 'Failed to send email notification');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email notification');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Claims
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Claim Details</h1>
              <p className="text-sm text-gray-600 mt-1">ID: {claim.id}</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={sendEmailNotification}
                disabled={sendingEmail || emailSent}
                className="flex items-center px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : emailSent ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Email Sent
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Email Claim
                  </>
                )}
              </button>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Status:</span>
                <select
                  value={status}
                  onChange={(e) => updateStatus(e.target.value)}
                  disabled={updating}
                  className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value="new">New</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                </select>
                {updating && <Loader2 className="w-5 h-5 animate-spin text-gray-600" />}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Incident Information
              </h2>
              <div className="space-y-4">
                <div className="flex items-start">
                  <Calendar className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Date & Time</p>
                    <p className="font-medium text-gray-900">
                      {new Date(claim.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Car className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Incident Type</p>
                    <p className="font-medium text-gray-900">
                      {claim.incident_type === 'motor_accident'
                        ? 'Motor Accident'
                        : 'Burst Geyser'}
                    </p>
                  </div>
                </div>

                {claim.location_lat && claim.location_lng && (
                  <div className="flex items-start">
                    <MapPin className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-2">Location</p>
                      {editingAddress ? (
                        <div className="space-y-2">
                          <textarea
                            value={locationAddress}
                            onChange={(e) => setLocationAddress(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            rows={2}
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={saveAddress}
                              disabled={savingAddress}
                              className="flex items-center px-3 py-1 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 text-sm"
                            >
                              <Save className="w-4 h-4 mr-1" />
                              {savingAddress ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => {
                                setLocationAddress(claim.location_address || '');
                                setEditingAddress(false);
                              }}
                              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900 mb-1">
                            {locationAddress || 'No address provided'}
                          </p>
                          <p className="text-xs text-gray-500 mb-2">
                            {claim.location_lat.toFixed(6)}, {claim.location_lng.toFixed(6)}
                          </p>
                          <div className="flex space-x-3">
                            <button
                              onClick={() => setEditingAddress(true)}
                              className="text-blue-700 text-sm hover:underline"
                            >
                              Edit Address
                            </button>
                            <a
                              href={`https://www.google.com/maps?q=${claim.location_lat},${claim.location_lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 text-sm hover:underline"
                            >
                              View on Google Maps
                            </a>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {claim.incident_type === 'burst_geyser' && claim.burst_datetime && (
                  <div className="flex items-start">
                    <Calendar className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Burst Date & Time</p>
                      <p className="font-medium text-gray-900">
                        {new Date(claim.burst_datetime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                {claim.incident_type === 'burst_geyser' && claim.geyser_type && (
                  <div className="flex items-start">
                    <Car className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Geyser Type</p>
                      <p className="font-medium text-gray-900 capitalize">
                        {claim.geyser_type}
                      </p>
                    </div>
                  </div>
                )}

                {claim.incident_type === 'burst_geyser' && claim.has_resulting_damage !== null && (
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Additional Damage</p>
                      <p className="font-medium text-gray-900">
                        {claim.has_resulting_damage ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                )}

                {claim.incident_type === 'motor_accident' && claim.car_condition && (
                  <div className="flex items-start">
                    <Car className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Car Condition</p>
                      <p className="font-medium text-gray-900 capitalize">
                        {claim.car_condition.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                )}

                {claim.incident_type === 'motor_accident' && claim.panel_beater_location && (
                  <div className="flex items-start">
                    <MapPin className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Preferred Panel Beater</p>
                      <p className="font-medium text-gray-900">
                        {claim.panel_beater_location}
                      </p>
                    </div>
                  </div>
                )}

                {claim.accident_date_time && (
                  <div className="flex items-start">
                    <Calendar className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Accident Date & Time</p>
                      <p className="font-medium text-gray-900">
                        {new Date(claim.accident_date_time).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {claim.incident_type === 'motor_accident' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Vehicle Documentation
                </h2>
                <div className="space-y-4">
                  {claim.driver_license_photo_url && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-gray-400 mr-3" />
                        <span className="text-sm font-medium text-gray-900">Driver License</span>
                      </div>
                      <button
                        onClick={() => downloadFile(claim.driver_license_photo_url, 'driver_license.jpg')}
                        className="flex items-center px-3 py-1 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        <span className="text-sm">Download</span>
                      </button>
                    </div>
                  )}

                  {claim.license_disk_photo_url && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-gray-400 mr-3" />
                        <span className="text-sm font-medium text-gray-900">License Disk</span>
                      </div>
                      <button
                        onClick={() => downloadFile(claim.license_disk_photo_url, 'license_disk.jpg')}
                        className="flex items-center px-3 py-1 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        <span className="text-sm">Download</span>
                      </button>
                    </div>
                  )}

                  {claim.third_party_license_photo_url && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-gray-400 mr-3" />
                        <span className="text-sm font-medium text-gray-900">Third Party License</span>
                      </div>
                      <button
                        onClick={() => downloadFile(claim.third_party_license_photo_url, 'third_party_license.jpg')}
                        className="flex items-center px-3 py-1 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        <span className="text-sm">Download</span>
                      </button>
                    </div>
                  )}

                  {claim.third_party_disk_photo_url && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-gray-400 mr-3" />
                        <span className="text-sm font-medium text-gray-900">Third Party Disk</span>
                      </div>
                      <button
                        onClick={() => downloadFile(claim.third_party_disk_photo_url, 'third_party_disk.jpg')}
                        className="flex items-center px-3 py-1 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        <span className="text-sm">Download</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Damage Photos
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {claim.damage_photo_urls && Array.isArray(claim.damage_photo_urls) && claim.damage_photo_urls.length > 0 ? (
                  claim.damage_photo_urls.map((url: string, index: number) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Damage ${index + 1}`}
                        className="w-full aspect-video object-cover rounded-lg"
                      />
                      <button
                        onClick={() => downloadFile(url, `damage_photo_${index + 1}.jpg`)}
                        className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <div className="bg-white rounded-full p-3">
                          <Download className="w-6 h-6 text-gray-900" />
                        </div>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 col-span-full">No damage photos</p>
                )}
              </div>
            </div>

            {claim.media_urls && Array.isArray(claim.media_urls) && claim.media_urls.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Additional Media
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {claim.media_urls.map((url: string, index: number) => (
                    <div key={index} className="relative group">
                      {url.includes('.mp4') || url.includes('video') ? (
                        <>
                          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                            <Video className="w-12 h-12 text-gray-400" />
                          </div>
                          <button
                            onClick={() => downloadFile(url, `video_${index + 1}.mp4`)}
                            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <div className="bg-white rounded-full p-3">
                              <Download className="w-6 h-6 text-gray-900" />
                            </div>
                          </button>
                        </>
                      ) : (
                        <>
                          <img
                            src={url}
                            alt={`Media ${index + 1}`}
                            className="w-full aspect-video object-cover rounded-lg"
                          />
                          <button
                            onClick={() => downloadFile(url, `media_${index + 1}.jpg`)}
                            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <div className="bg-white rounded-full p-3">
                              <Download className="w-6 h-6 text-gray-900" />
                            </div>
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {claim.voice_note_url && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Mic className="w-5 h-5 mr-2" />
                  Voice Statement
                </h2>
                <audio controls className="w-full mb-6">
                  <source src={claim.voice_note_url} type="audio/webm" />
                  Your browser does not support the audio element.
                </audio>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    Voice Transcription (English)
                  </h3>
                  {claim.voice_transcript_en ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-gray-900 leading-relaxed">{claim.voice_transcript_en}</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                      <p className="text-gray-600 text-sm italic">No transcription available</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-6">
            {(claim.claimant_name || claim.claimant_phone) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Contact Person
                </h2>
                <div className="space-y-3">
                  {claim.claimant_name && (
                    <div className="flex items-start">
                      <User className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                      <div>
                        <p className="text-sm text-gray-600">Name</p>
                        <p className="font-medium text-gray-900">{claim.claimant_name}</p>
                      </div>
                    </div>
                  )}
                  {claim.claimant_phone && (
                    <div className="flex items-start">
                      <Phone className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                      <div>
                        <p className="text-sm text-gray-600">Phone</p>
                        <a
                          href={`tel:${claim.claimant_phone}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {claim.claimant_phone}
                        </a>
                      </div>
                    </div>
                  )}
                  {claim.claimant_email && (
                    <div className="flex items-start">
                      <Mail className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <a
                          href={`mailto:${claim.claimant_email}`}
                          className="font-medium text-blue-700 hover:underline break-all"
                        >
                          {claim.claimant_email}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {claim.third_party_details && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Third Party Details
                </h2>
                <div className="space-y-3">
                  {claim.third_party_details.name && (
                    <div className="flex items-start">
                      <User className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                      <div>
                        <p className="text-sm text-gray-600">Name</p>
                        <p className="font-medium text-gray-900">{claim.third_party_details.name}</p>
                      </div>
                    </div>
                  )}
                  {claim.third_party_details.phone && (
                    <div className="flex items-start">
                      <Phone className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                      <div>
                        <p className="text-sm text-gray-600">Phone</p>
                        <a
                          href={`tel:${claim.third_party_details.phone}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {claim.third_party_details.phone}
                        </a>
                      </div>
                    </div>
                  )}
                  {claim.third_party_details.email && (
                    <div className="flex items-start">
                      <Mail className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <a
                          href={`mailto:${claim.third_party_details.email}`}
                          className="font-medium text-blue-700 hover:underline break-all"
                        >
                          {claim.third_party_details.email}
                        </a>
                      </div>
                    </div>
                  )}
                  {claim.third_party_details.vehicle && (
                    <div className="flex items-start">
                      <Car className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                      <div>
                        <p className="text-sm text-gray-600">Vehicle</p>
                        <p className="font-medium text-gray-900">{claim.third_party_details.vehicle}</p>
                      </div>
                    </div>
                  )}
                  {claim.third_party_details.registration && (
                    <div className="flex items-start">
                      <FileText className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                      <div>
                        <p className="text-sm text-gray-600">Registration</p>
                        <p className="font-medium text-gray-900">{claim.third_party_details.registration}</p>
                      </div>
                    </div>
                  )}
                  {claim.third_party_details.insurance && (
                    <div className="flex items-start">
                      <FileText className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                      <div>
                        <p className="text-sm text-gray-600">Insurance Company</p>
                        <p className="font-medium text-gray-900">{claim.third_party_details.insurance}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
