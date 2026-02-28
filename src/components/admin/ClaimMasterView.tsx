import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Loader2, Mail, Download, MapPin, Calendar, User, Phone, FileText, Image as ImageIcon, Video, X, Mic } from 'lucide-react';
import { generateClaimPDF, downloadClaimPack } from '../../lib/claimUtils';
import DynamicDataViewer from './DynamicDataViewer';

interface Attachment {
  url: string;
  kind: string;
  label?: string;
  path?: string;
  bucket?: string;
}

interface Claim {
  id: string;
  incident_type: string;
  status: string;
  created_at: string;
  claimant_name: string | null;
  claimant_phone: string | null;
  claimant_email: string | null;
  location: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  accident_date_time: string | null;
  car_condition: string | null;
  panel_beater_location: string | null;
  driver_license_photo_url: string | null;
  license_disk_photo_url: string | null;
  third_party_license_photo_url: string | null;
  third_party_disk_photo_url: string | null;
  damage_photo_urls: string[] | null;
  voice_note_url: string | null;
  voice_transcript_en: string | null;
  third_party_details: any | null;
  claimant_snapshot: any | null;
  claim_data: any | null;
  media_urls: string[] | null;
  burst_datetime: string | null;
  geyser_type: string | null;
  has_resulting_damage: boolean | null;
  theft_type: string | null;
  items_stolen: any[] | null;
  police_station: string | null;
  case_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  vehicle_registration: string | null;
  damage_type: string | null;
  damage_description: string | null;
  item_description: string | null;
  item_value: number | null;
  purchase_date: string | null;
  user_id: string | null;
  attachments: any | null;
  voice_transcript: string | null;
  client_name?: string;
}

interface ClaimMasterViewProps {
  claimId: string;
  onBack: () => void;
}

export default function ClaimMasterView({ claimId, onBack }: ClaimMasterViewProps) {
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    loadClaim();
  }, [claimId]);

  const loadClaim = async () => {
    try {
      setLoading(true);

      const { data: claimData, error: claimError } = await supabase
        .from('claims')
        .select('*')
        .eq('id', claimId)
        .maybeSingle();

      if (claimError) throw claimError;

      if (claimData) {
        const displayName = claimData.claimant_name?.trim()
          ? claimData.claimant_name
          : (claimData.claimant_email?.trim() ? claimData.claimant_email : 'Unknown');

        setClaim({
          ...claimData,
          client_name: displayName,
        });
      }
    } catch (error: any) {
      console.error('Error loading claim:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailInsurer = async () => {
    if (!claim) return;

    try {
      setEmailLoading(true);
      const pdfBlob = await generateClaimPDF(claim);

      const allFiles: string[] = [];
      if (claim.driver_license_photo_url) allFiles.push(claim.driver_license_photo_url);
      if (claim.license_disk_photo_url) allFiles.push(claim.license_disk_photo_url);
      if (claim.third_party_license_photo_url) allFiles.push(claim.third_party_license_photo_url);
      if (claim.third_party_disk_photo_url) allFiles.push(claim.third_party_disk_photo_url);
      if (claim.damage_photo_urls) allFiles.push(...claim.damage_photo_urls);
      if (claim.media_urls) allFiles.push(...claim.media_urls);

      const totalSizeMB = (pdfBlob.size + allFiles.length * 1024 * 1024 * 2) / (1024 * 1024);

      if (totalSizeMB > 20) {
        alert('Attachments exceed 20MB. Please use the Download Pack feature instead.');
        setEmailLoading(false);
        return;
      }

      setShowEmailModal(true);
    } catch (error: any) {
      console.error('Error preparing email:', error);
      alert('Failed to prepare email: ' + error.message);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleDownloadPack = async () => {
    if (!claim) return;

    try {
      setDownloadLoading(true);
      await downloadClaimPack(claim);
    } catch (error: any) {
      console.error('Error downloading pack:', error);
      alert('Failed to download pack: ' + error.message);
    } finally {
      setDownloadLoading(false);
    }
  };

  const getAttachments = (): Attachment[] => {
    if (!claim) return [];

    let attachments: Attachment[] = [];
    if (claim.attachments) {
      attachments = typeof claim.attachments === 'string'
        ? JSON.parse(claim.attachments)
        : claim.attachments;
    }

    return attachments;
  };

  const getAllMediaUrls = () => {
    if (!claim) return [];

    const attachments = getAttachments();
    if (attachments.length > 0) {
      const photos = attachments.filter(a =>
        ['damage_photo', 'driver_license', 'license_disk', 'third_party_license', 'third_party_disk', 'media', 'photo'].includes(a.kind)
      );
      return photos.map(p => p.url);
    }

    // Fallback to legacy fields
    const urls: string[] = [];
    if (claim.driver_license_photo_url) urls.push(claim.driver_license_photo_url);
    if (claim.license_disk_photo_url) urls.push(claim.license_disk_photo_url);
    if (claim.third_party_license_photo_url) urls.push(claim.third_party_license_photo_url);
    if (claim.third_party_disk_photo_url) urls.push(claim.third_party_disk_photo_url);
    if (claim.damage_photo_urls) urls.push(...claim.damage_photo_urls);
    if (claim.media_urls) urls.push(...claim.media_urls);
    return urls;
  };

  const getVoiceNote = (): Attachment | null => {
    const attachments = getAttachments();
    return attachments.find(a => a.kind === 'voice_note') || null;
  };

  const getDisplayLocation = (): string | null => {
    if (!claim) return null;

    if (claim.location?.trim()) {
      return claim.location;
    }
    if (claim.claim_data?.location_address) {
      return claim.claim_data.location_address;
    }
    if (claim.claim_data?.locationAddress) {
      return claim.claim_data.locationAddress;
    }
    if (claim.location_address) {
      return claim.location_address;
    }
    return null;
  };

  const renderField = (label: string, value: any) => {
    if (value === null || value === undefined) return null;
    return (
      <div className="mb-4">
        <p className="text-sm font-semibold text-gray-600 mb-1">{label}</p>
        <p className="text-gray-900">{String(value)}</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-700" />
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Claim not found</p>
          <button onClick={onBack} className="text-blue-700 hover:underline">Go Back</button>
        </div>
      </div>
    );
  }

  const mediaUrls = getAllMediaUrls();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Claim Details</h1>
              <p className="text-sm text-gray-600 mt-1">Ref: {claim.id.slice(0, 8)}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleEmailInsurer}
                disabled={emailLoading}
                className="flex items-center gap-2 px-6 py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
              >
                {emailLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Mail className="w-5 h-5" />
                )}
                Email Insurer
              </button>

              <button
                onClick={handleDownloadPack}
                disabled={downloadLoading}
                className="flex items-center gap-2 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50"
              >
                {downloadLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                Download Pack
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Claim Information</h2>

            {renderField('Incident Type', claim.incident_type?.replace('_', ' ').toUpperCase())}
            {renderField('Status', claim.status?.toUpperCase())}
            {renderField('Submitted', new Date(claim.created_at).toLocaleString())}
            {renderField('Claimant Name', claim.client_name)}
            {renderField('Claimant Phone', claim.claimant_phone)}
            {renderField('Claimant Email', claim.claimant_email)}

            {claim.third_party_details && (
              <div className="mt-6 mb-6 p-4 bg-gray-50 border-l-4 border-blue-500 rounded">
                <h3 className="font-semibold text-gray-900 mb-3">Third Party Details</h3>
                {claim.third_party_details.name && (
                  <div className="mb-2">
                    <span className="text-sm text-gray-600">Name: </span>
                    <span className="text-sm font-medium text-gray-900">{claim.third_party_details.name}</span>
                  </div>
                )}
                {claim.third_party_details.phone && (
                  <div className="mb-2">
                    <span className="text-sm text-gray-600">Phone: </span>
                    <span className="text-sm font-medium text-gray-900">{claim.third_party_details.phone}</span>
                  </div>
                )}
                {claim.third_party_details.email && (
                  <div className="mb-2">
                    <span className="text-sm text-gray-600">Email: </span>
                    <span className="text-sm font-medium text-gray-900">{claim.third_party_details.email}</span>
                  </div>
                )}
                {claim.third_party_details.vehicle && (
                  <div className="mb-2">
                    <span className="text-sm text-gray-600">Vehicle: </span>
                    <span className="text-sm font-medium text-gray-900">{claim.third_party_details.vehicle}</span>
                  </div>
                )}
                {claim.third_party_details.registration && (
                  <div className="mb-2">
                    <span className="text-sm text-gray-600">Registration: </span>
                    <span className="text-sm font-medium text-gray-900">{claim.third_party_details.registration}</span>
                  </div>
                )}
                {claim.third_party_details.insurance && (
                  <div className="mb-2">
                    <span className="text-sm text-gray-600">Insurance: </span>
                    <span className="text-sm font-medium text-gray-900">{claim.third_party_details.insurance}</span>
                  </div>
                )}
              </div>
            )}

            {renderField('Location', getDisplayLocation())}
            {renderField('Accident Date/Time', claim.accident_date_time ? new Date(claim.accident_date_time).toLocaleString() : null)}
            {renderField('Car Condition', claim.car_condition)}
            {renderField('Panel Beater Location', claim.panel_beater_location)}
            {renderField('Burst Date/Time', claim.burst_datetime ? new Date(claim.burst_datetime).toLocaleString() : null)}
            {renderField('Geyser Type', claim.geyser_type)}
            {renderField('Has Resulting Damage', claim.has_resulting_damage !== null ? (claim.has_resulting_damage ? 'Yes' : 'No') : null)}
            {renderField('Theft Type', claim.theft_type)}
            {renderField('Police Station', claim.police_station)}
            {renderField('Case Number', claim.case_number)}
            {renderField('Vehicle Make', claim.vehicle_make)}
            {renderField('Vehicle Model', claim.vehicle_model)}
            {renderField('Vehicle Year', claim.vehicle_year)}
            {renderField('Vehicle Registration', claim.vehicle_registration)}
            {renderField('Damage Type', claim.damage_type)}
            {renderField('Damage Description', claim.damage_description)}
            {renderField('Item Description', claim.item_description)}
            {renderField('Item Value', claim.item_value ? `R ${claim.item_value}` : null)}
            {renderField('Purchase Date', claim.purchase_date)}
          </div>

          {claim.claim_data && Object.keys(claim.claim_data).length > 0 && (
            <DynamicDataViewer data={claim.claim_data} title="Complete Submitted Data" />
          )}

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Evidence ({mediaUrls.length + (getVoiceNote() ? 1 : 0)})
            </h2>

            {mediaUrls.length === 0 && !getVoiceNote() ? (
              <div className="text-center py-12">
                <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No media files attached</p>
              </div>
            ) : (
              <div className="space-y-6">
                {getVoiceNote() && (
                  <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Mic className="w-5 h-5 text-blue-600" />
                      Voice Statement
                    </h3>
                    <audio controls className="w-full mb-4">
                      <source src={getVoiceNote()!.url} type="audio/webm" />
                      <source src={getVoiceNote()!.url} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                    {claim.voice_transcript && (
                      <div className="mt-4 p-4 bg-white rounded-lg">
                        <p className="text-sm font-semibold text-gray-600 mb-2">Transcript</p>
                        <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap">{claim.voice_transcript}</p>
                      </div>
                    )}
                  </div>
                )}

                {mediaUrls.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    {mediaUrls.map((url, index) => (
                      <div
                        key={index}
                        onClick={() => setSelectedImage(url)}
                        className="aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:border-blue-500 transition-all"
                      >
                        {url.includes('.mp4') || url.includes('.webm') ? (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <Video className="w-12 h-12 text-gray-400" />
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt={`Evidence ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={selectedImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {showEmailModal && (
        <EmailModal
          claim={claim}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  );
}

function EmailModal({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState(`Insurance Claim - ${claim.incident_type?.replace('_', ' ')} - Ref: ${claim.id.slice(0, 8)}`);
  const [message, setMessage] = useState(`Dear Insurer,\n\nPlease find attached the claim details and supporting documentation for the above reference.\n\nBest regards`);

  const handleSend = () => {
    const mailtoLink = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.location.href = mailtoLink;
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Compose Email</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="insurer@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              Note: This will open your default email client. You'll need to manually attach the generated PDF and evidence files.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!toEmail}
              className="px-6 py-2 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
            >
              Open Email Client
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
