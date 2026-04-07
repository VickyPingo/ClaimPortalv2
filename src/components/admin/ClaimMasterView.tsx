import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { safePersonName } from '../../lib/display';
import { ArrowLeft, Loader2, Mail, Download, MapPin, Calendar, User, Phone, FileText, Image as ImageIcon, Video, X, Mic, CreditCard as Edit2, Save } from 'lucide-react';
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
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState('');
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
        let displayName = 'Client';

        if (claimData.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', claimData.user_id)
            .maybeSingle();

          displayName = safePersonName(profile?.full_name) || safePersonName(claimData.claimant_name);
        } else {
          displayName = safePersonName(claimData.claimant_name);
        }

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
      const response = await fetch('/.netlify/functions/download-claim-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId: claim.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to download pack' }));
        throw new Error(errorData.message || 'Failed to download pack');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claim_${claim.id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading pack:', error);
      alert('Failed to download pack: ' + error.message);
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleTranscribeVoice = async () => {
    if (!claim) return;

    try {
      setTranscribing(true);
      setTranscriptError(null);

      const response = await fetch('/.netlify/functions/transcribe-claim-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId: claim.id }),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.message || 'Transcription failed');
      }

      await loadClaim();
    } catch (error: any) {
      console.error('Error transcribing voice:', error);
      setTranscriptError(error.message);
    } finally {
      setTranscribing(false);
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

  const getAllEvidence = (): Attachment[] => {
    if (!claim) return [];

    // Collect all evidence from multiple sources
    const allEvidence: Attachment[] = [];

    // 1. Main attachments array
    if (claim.attachments) {
      const attachments = typeof claim.attachments === 'string'
        ? JSON.parse(claim.attachments)
        : claim.attachments;
      allEvidence.push(...(attachments || []));
    }

    // 2. Documentation array (if exists)
    if (claim.claimant_snapshot?.documentation) {
      const docs = typeof claim.claimant_snapshot.documentation === 'string'
        ? JSON.parse(claim.claimant_snapshot.documentation)
        : claim.claimant_snapshot.documentation;
      allEvidence.push(...(docs || []));
    }

    // 3. Attachments from claimant_snapshot (if exists)
    if (claim.claimant_snapshot?.attachments) {
      const snapAttachments = typeof claim.claimant_snapshot.attachments === 'string'
        ? JSON.parse(claim.claimant_snapshot.attachments)
        : claim.claimant_snapshot.attachments;
      allEvidence.push(...(snapAttachments || []));
    }

    // Filter to items with URLs (exclude voice_note, we handle that separately)
    return allEvidence.filter(item =>
      item?.url &&
      item.kind !== 'voice_note' &&
      item.kind !== 'damage_description_audio'
    );
  };

  const isImageFile = (url: string) => {
    const lower = url.toLowerCase();
    return lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') || lower.includes('.webp') || lower.includes('.gif');
  };

  const isVideoFile = (url: string) => {
    const lower = url.toLowerCase();
    return lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mov');
  };

  const isAudioFile = (url: string) => {
    const lower = url.toLowerCase();
    return lower.includes('.mp3') || lower.includes('.wav') || lower.includes('.ogg') || lower.includes('.m4a');
  };

  const isPDFFile = (url: string) => {
    return url.toLowerCase().includes('.pdf');
  };

  const getAllMediaUrls = () => {
    const evidence = getAllEvidence();
    if (evidence.length > 0) {
      return evidence.map(item => item.url).filter(Boolean);
    }

    // Fallback to legacy fields
    if (!claim) return [];
    const legacyUrls: string[] = [];
    if (claim.driver_license_photo_url) legacyUrls.push(claim.driver_license_photo_url);
    if (claim.license_disk_photo_url) legacyUrls.push(claim.license_disk_photo_url);
    if (claim.third_party_license_photo_url) legacyUrls.push(claim.third_party_license_photo_url);
    if (claim.third_party_disk_photo_url) legacyUrls.push(claim.third_party_disk_photo_url);
    if (claim.damage_photo_urls) legacyUrls.push(...claim.damage_photo_urls);
    if (claim.media_urls) legacyUrls.push(...claim.media_urls);
    return legacyUrls;
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

  const handleSaveTranscript = async () => {
    if (!claim) return;
    setSavingTranscript(true);
    try {
      const { error } = await supabase
        .from('claims')
        .update({
          voice_transcript: transcriptDraft,
          claim_data: {
            ...claim.claim_data,
            voice_transcript: transcriptDraft,
          }
        })
        .eq('id', claim.id);

      if (error) throw error;

      setClaim({
        ...claim,
        voice_transcript: transcriptDraft,
        claim_data: {
          ...claim.claim_data,
          voice_transcript: transcriptDraft,
        }
      });
      setEditingTranscript(false);
    } catch (err: any) {
      alert('Failed to save transcript: ' + err.message);
    } finally {
      setSavingTranscript(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!claim) return;
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('claims')
        .update({ status: newStatus })
        .eq('id', claim.id);

      if (error) throw error;
      setClaim({ ...claim, status: newStatus });
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const renderField = (label: string, value: any) => {
    if (value === null || value === undefined || value === '') return null;
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

            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-600 mb-2">Status</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'new', label: 'New', color: 'bg-red-100 text-red-700 border-red-300' },
                  { value: 'awaiting_info', label: 'Awaiting Info', color: 'bg-orange-100 text-orange-700 border-orange-300' },
                  { value: 'investigating', label: 'Investigating', color: 'bg-blue-100 text-blue-700 border-blue-300' },
                  { value: 'submitted', label: 'Submitted to Insurer', color: 'bg-purple-100 text-purple-700 border-purple-300' },
                  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
                  { value: 'approved', label: 'Approved', color: 'bg-green-100 text-green-700 border-green-300' },
                  { value: 'rejected', label: 'Rejected', color: 'bg-gray-100 text-gray-700 border-gray-300' },
                  { value: 'paid', label: 'Paid', color: 'bg-green-200 text-green-800 border-green-400' },
                  { value: 'closed', label: 'Closed', color: 'bg-gray-200 text-gray-800 border-gray-400' },
                ].map(({ value, label, color }) => (
                  <button
                    key={value}
                    onClick={() => handleStatusChange(value)}
                    disabled={updatingStatus || claim.status === value}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      claim.status === value
                        ? `${color} ring-2 ring-offset-1 ring-current scale-105`
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                    } disabled:opacity-50`}
                  >
                    {updatingStatus && claim.status !== value ? label : label}
                    {claim.status === value && ' ✓'}
                  </button>
                ))}
              </div>
              {updatingStatus && (
                <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Updating status...
                </p>
              )}
            </div>

            {renderField('Submitted', new Date(claim.created_at).toLocaleString())}
            {renderField('Claimant Name', claim.client_name)}
            {renderField('Claimant Phone', claim.claimant_phone)}
            {renderField('Claimant Email', claim.claimant_email)}

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-600">Voice Transcript</p>
                {(claim.claim_data?.voice_transcript || claim.voice_transcript) && !editingTranscript && (
                  <button
                    onClick={() => {
                      setTranscriptDraft(claim.claim_data?.voice_transcript || claim.voice_transcript || '');
                      setEditingTranscript(true);
                    }}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </button>
                )}
              </div>

              {editingTranscript ? (
                <div className="mt-2">
                  {/* Keep audio player visible while editing */}
                  {getVoiceNote() && (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs font-medium text-blue-700 mb-2">
                        🎧 Listen while you edit:
                      </p>
                      <audio controls className="w-full">
                        <source src={getVoiceNote()!.url} type="audio/webm" />
                        <source src={getVoiceNote()!.url} type="audio/mpeg" />
                      </audio>
                    </div>
                  )}
                  <textarea
                    value={transcriptDraft}
                    onChange={(e) => setTranscriptDraft(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    placeholder="Edit transcript..."
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleSaveTranscript}
                      disabled={savingTranscript}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 disabled:opacity-50"
                    >
                      {savingTranscript ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      {savingTranscript ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingTranscript(false)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (claim.claim_data?.voice_transcript || claim.voice_transcript) ? (
                <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {claim.claim_data?.voice_transcript || claim.voice_transcript}
                  </p>
                </div>
              ) : getVoiceNote() ? (
                <div className="mt-2">
                  <button
                    onClick={handleTranscribeVoice}
                    disabled={transcribing}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {transcribing ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Transcribing...
                      </>
                    ) : (
                      <>
                        <Mic className="w-3 h-3" />
                        Transcribe Voice Note
                      </>
                    )}
                  </button>
                  {transcriptError && (
                    <p className="mt-1 text-xs text-red-600">{transcriptError}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Not transcribed yet</p>
              )}
            </div>

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
            {renderField('Panel Beater Location', claim.panel_beater_location || claim.claim_data?.panel_beater_location)}
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
              Evidence ({getAllEvidence().length + (getVoiceNote() ? 1 : 0)})
            </h2>

            {getAllEvidence().length === 0 && !getVoiceNote() ? (
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
                    {(claim.claim_data?.voice_transcript || claim.voice_transcript) ? (
                      <div className="mt-4 p-4 bg-white rounded-lg">
                        <p className="text-sm font-semibold text-gray-600 mb-2">Transcript</p>
                        <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap">{claim.claim_data?.voice_transcript || claim.voice_transcript}</p>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <button
                          onClick={handleTranscribeVoice}
                          disabled={transcribing}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {transcribing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Transcribing...
                            </>
                          ) : (
                            <>
                              <Mic className="w-4 h-4" />
                              Transcribe Voice Note
                            </>
                          )}
                        </button>
                        {transcriptError && (
                          <p className="mt-2 text-sm text-red-600">{transcriptError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {getAllEvidence().length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    {getAllEvidence().map((item, index) => {
                      const url = item.url;
                      const label = item.label || item.kind || `File ${index + 1}`;

                      if (isImageFile(url)) {
                        return (
                          <div
                            key={index}
                            onClick={() => setSelectedImage(url)}
                            className="aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:border-blue-500 transition-all"
                          >
                            <img
                              src={url}
                              alt={label}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-2">
                              {label}
                            </div>
                          </div>
                        );
                      } else if (isVideoFile(url)) {
                        return (
                          <div
                            key={index}
                            onClick={() => window.open(url, '_blank')}
                            className="aspect-square rounded-lg border border-gray-200 cursor-pointer hover:border-blue-500 transition-all bg-gray-100 flex flex-col items-center justify-center p-4"
                          >
                            <Video className="w-12 h-12 text-gray-400 mb-2" />
                            <p className="text-xs text-gray-600 text-center">{label}</p>
                          </div>
                        );
                      } else if (isAudioFile(url)) {
                        return (
                          <div key={index} className="col-span-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-sm font-medium text-gray-900 mb-2">{label}</p>
                            <audio controls className="w-full">
                              <source src={url} />
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        );
                      } else if (isPDFFile(url)) {
                        return (
                          <div
                            key={index}
                            onClick={() => window.open(url, '_blank')}
                            className="aspect-square rounded-lg border border-gray-200 cursor-pointer hover:border-blue-500 transition-all bg-red-50 flex flex-col items-center justify-center p-4"
                          >
                            <FileText className="w-12 h-12 text-red-600 mb-2" />
                            <p className="text-xs text-gray-900 text-center font-medium">{label}</p>
                            <p className="text-xs text-gray-500 mt-1">PDF Document</p>
                          </div>
                        );
                      } else {
                        return (
                          <div
                            key={index}
                            onClick={() => window.open(url, '_blank')}
                            className="aspect-square rounded-lg border border-gray-200 cursor-pointer hover:border-blue-500 transition-all bg-gray-50 flex flex-col items-center justify-center p-4"
                          >
                            <FileText className="w-12 h-12 text-gray-400 mb-2" />
                            <p className="text-xs text-gray-900 text-center font-medium">{label}</p>
                            <p className="text-xs text-gray-500 mt-1">Click to open</p>
                          </div>
                        );
                      }
                    })}
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
  const [sending, setSending] = useState(false);

  const handleSendEmail = async () => {
    if (!toEmail || !subject || !message) return;

    setSending(true);
    try {
      const response = await fetch('/.netlify/functions/send-claim-to-insurer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail,
          subject,
          message,
          claimId: claim.id,
          claimantName: claim.claimant_name,
          incidentType: claim.incident_type,
          attachments: claim.attachments || [],
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Failed to send');

      alert(`Email sent successfully with ${result.attachmentCount} attachment(s)!`);
      onClose();
    } catch (err: any) {
      alert('Failed to send email: ' + err.message);
    } finally {
      setSending(false);
    }
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

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={sending}
              className="px-6 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSendEmail}
              disabled={!toEmail || sending}
              className="flex items-center gap-2 px-6 py-2 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
            >
              {sending && <Loader2 className="w-4 h-4 animate-spin" />}
              {sending ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
