import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { submitClaimUnified } from '../lib/claimSubmission';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Mic,
  Camera,
  Globe,
  Lock,
  Smartphone,
} from 'lucide-react';

type Step = 1 | 2 | 3 | 4 | 5 | 'success';
type IncidentType = 'stolen' | 'accidentally_damaged' | 'lost_missing' | null;

interface ClaimItem {
  id: string;
  description: string;
  makeModel: string;
  serialImei: string;
  replacementValue: number;
  onPolicy: 'yes' | 'no' | 'unsure' | null;
  category: string;
  deviceBlacklisted?: boolean;
  findMyDeviceLocked?: boolean;
  hasValuationCert?: boolean;
}

interface AllRiskFormProps {
  clientId?: string;
  brokerageId: string;
  onBack: () => void;
}

const ITEM_CATEGORIES = [
  'Mobile Phone',
  'Tablet',
  'Laptop',
  'Watch',
  'Jewelry',
  'Camera',
  'Headphones',
  'Gaming Console',
  'Smartwatch',
  'Other Electronics',
  'Clothing',
  'Accessory',
  'Other',
];

export default function AllRiskForm({
  clientId,
  brokerageId,
  onBack,
}: AllRiskFormProps) {
  const { brokerProfile } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);

  const [incidentType, setIncidentType] = useState<IncidentType>(null);
  const [incidentDateTime, setIncidentDateTime] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [isInternational, setIsInternational] = useState(false);
  const [departureDate, setDepartureDate] = useState('');

  const [sapsCase, setSapsCase] = useState('');
  const [damageDescriptionAudio, setDamageDescriptionAudio] = useState<Blob | null>(null);
  const [isDamageRecording, setIsDamageRecording] = useState(false);
  const damageMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const damageAudioChunksRef = useRef<Blob[]>([]);
  const [lastKnownLocation, setLastKnownLocation] = useState('');

  const [items, setItems] = useState<ClaimItem[]>([]);
  const [newItem, setNewItem] = useState<Partial<ClaimItem>>({});

  const [isRepairable, setIsRepairable] = useState<boolean | null>(null);
  const [damageReportFile, setDamageReportFile] = useState<File | null>(null);
  const [repairQuoteFile, setRepairQuoteFile] = useState<File | null>(null);
  const [replacementQuoteFile, setReplacementQuoteFile] = useState<File | null>(null);

  const [proofOfOwnershipFiles, setProofOfOwnershipFiles] = useState<File[]>([]);
  const [policeReportFile, setPoliceReportFile] = useState<File | null>(null);
  const [valuationCertFile, setValuationCertFile] = useState<File | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const mediaDeviceId = useRef(Math.random().toString());

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
      alert('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const startDamageRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      damageMediaRecorderRef.current = mediaRecorder;
      damageAudioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          damageAudioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(damageAudioChunksRef.current, { type: 'audio/webm' });
        setDamageDescriptionAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsDamageRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
      alert('Could not access microphone');
    }
  };

  const stopDamageRecording = () => {
    if (damageMediaRecorderRef.current && isDamageRecording) {
      damageMediaRecorderRef.current.stop();
      setIsDamageRecording(false);
    }
  };

  const addItem = () => {
    if (!newItem.description || !newItem.replacementValue || !newItem.category || newItem.onPolicy === null) {
      alert('Please fill in all required fields');
      return;
    }

    const isPhoneOrTablet = ['Mobile Phone', 'Tablet'].includes(newItem.category as string);
    const isJewelryOrWatch = ['Jewelry', 'Watch'].includes(newItem.category as string);

    if (
      isPhoneOrTablet &&
      (newItem.deviceBlacklisted === undefined || newItem.findMyDeviceLocked === undefined)
    ) {
      alert('Please answer the device security questions');
      return;
    }

    if (isJewelryOrWatch && newItem.hasValuationCert === undefined) {
      alert('Please answer the valuation certificate question');
      return;
    }

    const item: ClaimItem = {
      id: Date.now().toString(),
      description: newItem.description || '',
      makeModel: newItem.makeModel || '',
      serialImei: newItem.serialImei || '',
      replacementValue: newItem.replacementValue || 0,
      onPolicy: (newItem.onPolicy as 'yes' | 'no' | 'unsure') || 'unsure',
      category: newItem.category || '',
      deviceBlacklisted: newItem.deviceBlacklisted,
      findMyDeviceLocked: newItem.findMyDeviceLocked,
      hasValuationCert: newItem.hasValuationCert,
    };

    setItems([...items, item]);
    setNewItem({});
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const uploadFile = async (file: File, bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const submitClaim = async () => {
    if (!incidentType || !incidentDateTime || !incidentLocation || items.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const timestamp = Date.now();
      const tempId = `allrisk_${timestamp}`;

      let voiceNoteUrl = null;
      let voiceTranscript = null;
      let damageDescriptionUrl = null;
      let damageDescriptionTranscript = null;

      if (audioBlob) {
        const audioFile = new File([audioBlob], 'voice_note.webm', {
          type: 'audio/webm',
        });
        voiceNoteUrl = await uploadFile(
          audioFile,
          'claims',
          `${tempId}/${timestamp}/voice_note.webm`
        );

        try {
          const transcriptionResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({ audioUrl: voiceNoteUrl }),
            }
          );

          if (transcriptionResponse.ok) {
            const { transcript } = await transcriptionResponse.json();
            voiceTranscript = transcript;
          }
        } catch (err) {
          console.error('Transcription error:', err);
        }
      }

      if (damageDescriptionAudio) {
        const damageAudioFile = new File([damageDescriptionAudio], 'damage_description.webm', {
          type: 'audio/webm',
        });
        damageDescriptionUrl = await uploadFile(
          damageAudioFile,
          'claims',
          `${tempId}/${timestamp}/damage_description.webm`
        );

        try {
          const transcriptionResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({ audioUrl: damageDescriptionUrl }),
            }
          );

          if (transcriptionResponse.ok) {
            const { transcript } = await transcriptionResponse.json();
            damageDescriptionTranscript = transcript;
          }
        } catch (err) {
          console.error('Transcription error:', err);
        }
      }

      const proofOfOwnershipUrls = [];
      for (let i = 0; i < proofOfOwnershipFiles.length; i++) {
        proofOfOwnershipUrls.push(
          await uploadFile(
            proofOfOwnershipFiles[i],
            'claims',
            `${tempId}/${timestamp}/proof_${i + 1}.jpg`
          )
        );
      }

      let damageReportUrl = null;
      if (damageReportFile) {
        damageReportUrl = await uploadFile(
          damageReportFile,
          'claims',
          `${tempId}/${timestamp}/damage_report.pdf`
        );
      }

      let repairQuoteUrl = null;
      if (repairQuoteFile) {
        repairQuoteUrl = await uploadFile(
          repairQuoteFile,
          'claims',
          `${tempId}/${timestamp}/repair_quote.pdf`
        );
      }

      let replacementQuoteUrl = null;
      if (replacementQuoteFile) {
        replacementQuoteUrl = await uploadFile(
          replacementQuoteFile,
          'claims',
          `${tempId}/${timestamp}/replacement_quote.pdf`
        );
      }

      let policeReportUrl = null;
      if (policeReportFile) {
        policeReportUrl = await uploadFile(
          policeReportFile,
          'claims',
          `${tempId}/${timestamp}/police_report.pdf`
        );
      }

      let valuationCertUrl = null;
      if (valuationCertFile) {
        valuationCertUrl = await uploadFile(
          valuationCertFile,
          'claims',
          `${tempId}/${timestamp}/valuation_cert.pdf`
        );
      }

      // Build attachments array
      const attachments: Array<{ bucket: string; path: string; url: string; kind?: string; label?: string }> = [];

      if (voiceNoteUrl) {
        attachments.push({ bucket: 'claims', path: `${tempId}/${timestamp}/voice_note.webm`, url: voiceNoteUrl, kind: 'voice_note', label: 'Voice Statement' });
      }

      if (damageDescriptionUrl) {
        attachments.push({ bucket: 'claims', path: `${tempId}/${timestamp}/damage_description.webm`, url: damageDescriptionUrl, kind: 'damage_description_audio', label: 'Damage Description Audio' });
      }

      proofOfOwnershipUrls.forEach((url, i) => {
        attachments.push({ bucket: 'claims', path: `${tempId}/${timestamp}/proof_${i + 1}.jpg`, url, kind: 'proof_of_ownership', label: `Proof of Ownership ${i + 1}` });
      });

      if (damageReportUrl) {
        attachments.push({ bucket: 'claims', path: `${tempId}/${timestamp}/damage_report.pdf`, url: damageReportUrl, kind: 'damage_report', label: 'Damage Report' });
      }

      if (repairQuoteUrl) {
        attachments.push({ bucket: 'claims', path: `${tempId}/${timestamp}/repair_quote.pdf`, url: repairQuoteUrl, kind: 'repair_quote', label: 'Repair Quote' });
      }

      if (replacementQuoteUrl) {
        attachments.push({ bucket: 'claims', path: `${tempId}/${timestamp}/replacement_quote.pdf`, url: replacementQuoteUrl, kind: 'replacement_quote', label: 'Replacement Quote' });
      }

      if (policeReportUrl) {
        attachments.push({ bucket: 'claims', path: `${tempId}/${timestamp}/police_report.pdf`, url: policeReportUrl, kind: 'police_report', label: 'Police Report' });
      }

      if (valuationCertUrl) {
        attachments.push({ bucket: 'claims', path: `${tempId}/${timestamp}/valuation_cert.pdf`, url: valuationCertUrl, kind: 'valuation_certificate', label: 'Valuation Certificate' });
      }

      const claimData = {
        incident_type: incidentType,
        incident_date_time: incidentDateTime,
        incident_location: incidentLocation,
        is_international: isInternational,
        departure_date: departureDate || null,
        saps_case_number: sapsCase || null,
        damage_description_transcript: damageDescriptionTranscript,
        last_known_location: lastKnownLocation || null,
        items: items,
        is_repairable: isRepairable,
        voice_transcript: voiceTranscript,
      };

      await submitClaimUnified({
        claimType: 'all_risk',
        claimData: claimData,
        attachments: attachments,
      });
      setStep('success');
    } catch (error: any) {
      alert('Failed to submit claim: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Claim Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Your all-risk portable possessions claim has been successfully submitted. A broker will review your claim and contact you shortly.
          </p>
          <button
            onClick={onBack}
            className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="max-w-3xl mx-auto p-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">All-Risk Portable Possessions</h1>
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="flex-1 flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    step >= s
                      ? 'bg-blue-700 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s}
                </div>
                {s < 5 && (
                  <div
                    className={`flex-1 h-1 mx-1 ${
                      step > s ? 'bg-blue-700' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Incident Details
              </h2>
              <p className="text-gray-600 mb-6">
                Tell us what happened to your item
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    What happened? *
                  </label>
                  <div className="space-y-2">
                    {[
                      { id: 'stolen', label: 'Stolen', desc: 'Item was stolen or taken' },
                      { id: 'accidentally_damaged', label: 'Accidentally Damaged', desc: 'Item was damaged by accident' },
                      { id: 'lost_missing', label: 'Lost / Missing', desc: 'Item was lost or misplaced' },
                    ].map(({ id, label, desc }) => (
                      <button
                        key={id}
                        onClick={() => setIncidentType(id as IncidentType)}
                        className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                          incidentType === id
                            ? 'border-blue-700 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <p className="font-semibold text-gray-900">{label}</p>
                        <p className="text-xs text-gray-600">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date & Time of Incident *
                  </label>
                  <input
                    type="datetime-local"
                    value={incidentDateTime}
                    onChange={(e) => setIncidentDateTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Where did this happen? *
                  </label>
                  <input
                    type="text"
                    value={incidentLocation}
                    onChange={(e) => setIncidentLocation(e.target.value)}
                    placeholder="e.g., Cape Town International Airport"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Did this happen outside South Africa? *
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setIsInternational(false)}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        isInternational === false
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">No, in South Africa</p>
                    </button>
                    <button
                      onClick={() => setIsInternational(true)}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        isInternational === true
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">Yes, outside South Africa</p>
                    </button>
                  </div>
                </div>

                {isInternational && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date of Departure from SA *
                    </label>
                    <input
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Insurers typically cover up to 60-90 consecutive days abroad
                    </p>
                  </div>
                )}

                {incidentType === 'stolen' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SAPS Case Number *
                    </label>
                    <input
                      type="text"
                      value={sapsCase}
                      onChange={(e) => setSapsCase(e.target.value)}
                      placeholder="e.g., 2024001234"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {incidentType === 'accidentally_damaged' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Describe the Damage (Voice Note) *
                    </label>
                    <div className="text-center">
                      {!damageDescriptionAudio ? (
                        <div>
                          <button
                            onClick={isDamageRecording ? stopDamageRecording : startDamageRecording}
                            className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-4 ${
                              isDamageRecording
                                ? 'bg-red-500 animate-pulse'
                                : 'bg-blue-700 hover:bg-blue-800'
                            }`}
                          >
                            <Mic className="w-16 h-16 text-white" />
                          </button>
                          <p className="text-sm text-gray-600">
                            {isDamageRecording ? 'Tap to stop recording' : 'Tap to describe damage'}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                          <p className="text-sm text-gray-600 mb-4">Damage description recorded</p>
                          <button
                            onClick={() => setDamageDescriptionAudio(null)}
                            className="text-blue-700 text-sm hover:underline"
                          >
                            Record again
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {incidentType === 'lost_missing' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Known Location
                    </label>
                    <input
                      type="text"
                      value={lastKnownLocation}
                      onChange={(e) => setLastKnownLocation(e.target.value)}
                      placeholder="Where was the item last seen?"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <button
                  onClick={() => setStep(2)}
                  disabled={!incidentType || !incidentDateTime || !incidentLocation || (isInternational && !departureDate) || (incidentType === 'stolen' && !sapsCase) || (incidentType === 'accidentally_damaged' && !damageDescriptionAudio)}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Item Register
              </h2>
              <p className="text-gray-600 mb-6">
                Add items affected by this incident
              </p>

              {items.length > 0 && (
                <div className="mb-6 space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{item.description}</p>
                          <p className="text-sm text-gray-600">{item.category}</p>
                          {item.makeModel && <p className="text-xs text-gray-500">{item.makeModel}</p>}
                          <p className="text-sm text-blue-700 font-semibold mt-1">
                            R{item.replacementValue.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {item.onPolicy === 'yes' && 'On policy'}
                            {item.onPolicy === 'no' && 'Not on policy'}
                            {item.onPolicy === 'unsure' && 'Not sure if on policy'}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">Add New Item</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      value={newItem.category || ''}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select category</option>
                      {ITEM_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {incidentType === 'stolen' && ['Mobile Phone', 'Tablet'].includes(newItem.category as string) && (
                    <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                      <div className="flex items-start mb-3">
                        <Smartphone className="w-5 h-5 text-blue-700 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-blue-900 text-sm mb-2">Blacklisting Helper</h4>
                          <p className="text-sm text-blue-800 mb-3">
                            Note: To open a Police Case for a stolen phone, you first need to blacklist the device with your network provider to get an ITC Reference Number.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-white rounded p-2">
                          <p className="font-semibold text-gray-900">Vodacom</p>
                          <p className="text-gray-700">Dial 082 111</p>
                        </div>
                        <div className="bg-white rounded p-2">
                          <p className="font-semibold text-gray-900">MTN</p>
                          <p className="text-gray-700">Dial 135 or 083 135</p>
                        </div>
                        <div className="bg-white rounded p-2">
                          <p className="font-semibold text-gray-900">Cell C</p>
                          <p className="text-gray-700">Dial 140 or 084 140</p>
                        </div>
                        <div className="bg-white rounded p-2">
                          <p className="font-semibold text-gray-900">Telkom</p>
                          <p className="text-gray-700">Dial 081 180</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Item Description *
                    </label>
                    <input
                      type="text"
                      value={newItem.description || ''}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      placeholder="e.g., Apple Watch Ultra"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Make & Model
                    </label>
                    <input
                      type="text"
                      value={newItem.makeModel || ''}
                      onChange={(e) => setNewItem({ ...newItem, makeModel: e.target.value })}
                      placeholder="e.g., Apple Watch Series 8"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {['Mobile Phone', 'Tablet', 'Laptop', 'Camera', 'Smartwatch'].includes(newItem.category as string) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Serial / IMEI Number
                      </label>
                      <input
                        type="text"
                        value={newItem.serialImei || ''}
                        onChange={(e) => setNewItem({ ...newItem, serialImei: e.target.value })}
                        placeholder="Device serial or IMEI number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Replacement Value (R) *
                    </label>
                    <input
                      type="number"
                      value={newItem.replacementValue || ''}
                      onChange={(e) => setNewItem({ ...newItem, replacementValue: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Is this item specifically listed on your policy schedule? *
                    </label>
                    <div className="space-y-2">
                      {['yes', 'no', 'unsure'].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setNewItem({ ...newItem, onPolicy: opt as 'yes' | 'no' | 'unsure' })}
                          className={`w-full p-2 text-left rounded border-2 transition-all text-sm ${
                            newItem.onPolicy === opt
                              ? 'border-blue-700 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          {opt === 'yes' && 'Yes, it is listed'}
                          {opt === 'no' && 'No, not listed'}
                          {opt === 'unsure' && "I'm not sure"}
                        </button>
                      ))}
                    </div>

                    {newItem.onPolicy === 'no' && newItem.replacementValue && newItem.replacementValue > 5000 && (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start">
                        <AlertCircle className="w-4 h-4 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-700">
                          Check your policy limit. Items of this value usually need to be specified to be fully covered. We will submit this, but the payout may be capped.
                        </p>
                      </div>
                    )}
                  </div>

                  {['Mobile Phone', 'Tablet'].includes(newItem.category as string) && (
                    <div className="space-y-3 pt-2 border-t border-gray-200">
                      <label className="block text-sm font-medium text-gray-700">
                        Device Security
                      </label>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newItem.deviceBlacklisted || false}
                          onChange={(e) => setNewItem({ ...newItem, deviceBlacklisted: e.target.checked })}
                          className="w-4 h-4"
                          id="blacklisted"
                        />
                        <label htmlFor="blacklisted" className="ml-2 text-sm text-gray-700">
                          Device blacklisted with network provider
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newItem.findMyDeviceLocked || false}
                          onChange={(e) => setNewItem({ ...newItem, findMyDeviceLocked: e.target.checked })}
                          className="w-4 h-4"
                          id="findmy"
                        />
                        <label htmlFor="findmy" className="ml-2 text-sm text-gray-700">
                          Find My Device / iCloud locked
                        </label>
                      </div>
                    </div>
                  )}

                  {['Jewelry', 'Watch'].includes(newItem.category as string) && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newItem.hasValuationCert || false}
                          onChange={(e) => setNewItem({ ...newItem, hasValuationCert: e.target.checked })}
                          className="w-4 h-4"
                          id="valuation"
                        />
                        <label htmlFor="valuation" className="ml-2 text-sm text-gray-700">
                          I have a valuation certificate
                        </label>
                      </div>
                      {newItem.replacementValue && newItem.replacementValue > 15000 && !newItem.hasValuationCert && (
                        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start">
                          <AlertCircle className="w-4 h-4 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-700">
                            For items over R15,000, insurers typically require a valuation certificate prior to the loss.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {['Earrings', 'Cufflinks', 'Shoes'].some(word => (newItem.description || '').includes(word)) && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
                      <AlertCircle className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-700">
                        If claiming for a pair/set where only one item is lost, the insurer may require the remaining item to be surrendered as salvage.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={addItem}
                    disabled={!newItem.category || !newItem.description || !newItem.replacementValue || newItem.onPolicy === null}
                    className="w-full bg-blue-700 text-white py-2 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center text-sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </button>
                </div>
              </div>

              <button
                onClick={() => setStep(3)}
                disabled={items.length === 0}
                className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Damage Assessment
              </h2>
              <p className="text-gray-600 mb-6">
                Tell us about the condition of the item
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Is the item repairable? *
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setIsRepairable(true)}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        isRepairable === true
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">Yes, it can be repaired</p>
                    </button>
                    <button
                      onClick={() => setIsRepairable(false)}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        isRepairable === false
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">No, replacement needed</p>
                    </button>
                  </div>
                </div>

                {isRepairable === true && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Damage Report (PDF) *
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => setDamageReportFile(e.target.files?.[0] || null)}
                          className="hidden"
                          id="damage-report"
                        />
                        <label htmlFor="damage-report" className="cursor-pointer">
                          <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">
                            {damageReportFile ? damageReportFile.name : 'Tap to upload damage report'}
                          </p>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Repair Quote (PDF) *
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => setRepairQuoteFile(e.target.files?.[0] || null)}
                          className="hidden"
                          id="repair-quote"
                        />
                        <label htmlFor="repair-quote" className="cursor-pointer">
                          <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">
                            {repairQuoteFile ? repairQuoteFile.name : 'Tap to upload repair quote'}
                          </p>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {isRepairable === false && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Replacement Quote (PDF) *
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setReplacementQuoteFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="replacement-quote"
                      />
                      <label htmlFor="replacement-quote" className="cursor-pointer">
                        <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          {replacementQuoteFile ? replacementQuoteFile.name : 'Tap to upload replacement quote'}
                        </p>
                      </label>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setStep(4)}
                  disabled={isRepairable === null || (isRepairable === true && (!damageReportFile || !repairQuoteFile)) || (isRepairable === false && !replacementQuoteFile)}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Supporting Documents
              </h2>
              <p className="text-gray-600 mb-6">
                Provide evidence to support your claim
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Proof of Ownership *
                  </label>
                  <p className="text-xs text-gray-600 mb-3">
                    Invoice, box photo, or manual
                  </p>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={(e) => setProofOfOwnershipFiles(Array.from(e.target.files || []))}
                      className="hidden"
                      id="proof-ownership"
                    />
                    <label htmlFor="proof-ownership" className="cursor-pointer">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {proofOfOwnershipFiles.length > 0
                          ? `${proofOfOwnershipFiles.length} file(s) selected`
                          : 'Tap to upload proof of ownership'}
                      </p>
                    </label>
                  </div>
                </div>

                {incidentType === 'stolen' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Police Report / Affidavit (PDF) *
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setPoliceReportFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="police-report"
                      />
                      <label htmlFor="police-report" className="cursor-pointer">
                        <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          {policeReportFile ? policeReportFile.name : 'Tap to upload police report'}
                        </p>
                      </label>
                    </div>
                  </div>
                )}

                {items.some((item) => ['Jewelry', 'Watch'].includes(item.category)) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valuation Certificate (PDF)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setValuationCertFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="valuation-cert"
                      />
                      <label htmlFor="valuation-cert" className="cursor-pointer">
                        <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          {valuationCertFile ? valuationCertFile.name : 'Tap to upload valuation certificate'}
                        </p>
                      </label>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setStep(5)}
                  disabled={proofOfOwnershipFiles.length === 0 || (incidentType === 'stolen' && !policeReportFile)}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Submission Details
              </h2>
              <p className="text-gray-600 mb-6">
                Verify your information before submitting
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Voice Statement</h3>
                  <p className="text-gray-600 text-sm mb-4">Record a detailed account of the incident (optional)</p>
                  <div className="text-center">
                    {!audioBlob ? (
                      <div>
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-4 ${
                            isRecording
                              ? 'bg-red-500 animate-pulse'
                              : 'bg-blue-700 hover:bg-blue-800'
                          }`}
                        >
                          <Mic className="w-16 h-16 text-white" />
                        </button>
                        <p className="text-sm text-gray-600">
                          {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <p className="text-sm text-gray-600 mb-4">Recording saved</p>
                        <button
                          onClick={() => setAudioBlob(null)}
                          className="text-blue-700 text-sm hover:underline"
                        >
                          Record again
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={submitClaim}
                  disabled={loading}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Claim'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
