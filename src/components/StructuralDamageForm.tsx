import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  MapPin,
  Camera,
  Mic,
  Home,
  Lock,
  Cloud,
  Flame,
  Zap,
} from 'lucide-react';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 'success';
type IncidentType = 'storm_water' | 'fire_explosion' | 'impact' | 'accidental_fixtures' | 'theft_fixtures' | 'lightning_power_surge' | null;
type LightningSubType = 'fixed_items' | 'movable_items' | null;

interface StructuralDamageFormProps {
  clientId?: string;
  brokerageId: string;
  onBack: () => void;
}

const BANKS = [
  'Standard Bank',
  'ABSA',
  'FNB',
  'Nedbank',
  'SA Home Loans',
  'Investec',
  'Other',
];

const WATER_ENTRY_POINTS = ['Roof', 'Window', 'Rising damp', 'Flash flood'];
const ROOF_TYPES = ['Tile', 'Metal', 'Slate', 'Thatch'];

export default function StructuralDamageForm({
  clientId,
  brokerageId,
  onBack,
}: StructuralDamageFormProps) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState('');

  const [incidentType, setIncidentType] = useState<IncidentType>(null);
  const [lightningSubType, setLightningSubType] = useState<LightningSubType>(null);

  const [isHabitable, setIsHabitable] = useState<boolean | null>(null);
  const [isPropertySecure, setIsPropertySecure] = useState<boolean | null>(null);
  const [securityGuardRequested, setSecurityGuardRequested] = useState(false);

  const [waterEntryPoint, setWaterEntryPoint] = useState('');
  const [isGradualLeak, setIsGradualLeak] = useState<boolean | null>(null);

  const [roofConstruction, setRoofConstruction] = useState('');
  const [isGlassOnly, setIsGlassOnly] = useState<boolean | null>(null);

  const [isBonded, setIsBonded] = useState<boolean | null>(null);
  const [bondBank, setBondBank] = useState('');

  const [estimatedRepairCost, setEstimatedRepairCost] = useState('');
  const [damagePhotos, setDamagePhotos] = useState<File[]>([]);
  const [repairQuote1, setRepairQuote1] = useState<File | null>(null);
  const [repairQuote2, setRepairQuote2] = useState<File | null>(null);
  const [contractorReport, setContractorReport] = useState<File | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({ lat, lng });

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            );
            const data = await response.json();
            if (data.display_name) {
              setLocationAddress(data.display_name);
            }
          } catch (error) {
            console.error('Geocoding error:', error);
          }
        },
        (error) => {
          console.error('Location error:', error);
        }
      );
    }
  }, []);

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

  const uploadFile = async (file: File, bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const submitClaim = async () => {
    if (!incidentType || !isHabitable === null || !isPropertySecure === null) return;

    setLoading(true);
    try {
      const timestamp = Date.now();
      const tempId = `structural_${timestamp}`;

      let voiceNoteUrl = null;
      let voiceTranscript = null;

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

      const damagePhotoUrls = [];
      for (let i = 0; i < damagePhotos.length; i++) {
        damagePhotoUrls.push(
          await uploadFile(damagePhotos[i], 'claims', `${tempId}/${timestamp}/damage_${i + 1}.jpg`)
        );
      }

      const repairQuote1Url = repairQuote1
        ? await uploadFile(repairQuote1, 'claims', `${tempId}/${timestamp}/repair_quote_1.pdf`)
        : null;

      const repairQuote2Url = repairQuote2
        ? await uploadFile(repairQuote2, 'claims', `${tempId}/${timestamp}/repair_quote_2.pdf`)
        : null;

      const contractorReportUrl = contractorReport
        ? await uploadFile(contractorReport, 'claims', `${tempId}/${timestamp}/contractor_report.pdf`)
        : null;

      const { error: insertError } = await supabase
        .from('structural_damage_claims')
        .insert({
          brokerage_id: brokerageId,
          client_id: clientId || null,
          incident_type: incidentType,
          sub_incident_type: lightningSubType,
          is_habitable: isHabitable,
          is_property_secure: isPropertySecure,
          water_entry_point: waterEntryPoint || null,
          is_gradual_leak: isGradualLeak,
          roof_construction: roofConstruction || null,
          is_glass_only: isGlassOnly,
          is_bonded: isBonded,
          bond_holder_bank: bondBank || null,
          estimated_repair_cost: estimatedRepairCost ? parseFloat(estimatedRepairCost) : null,
          damage_photos_urls: damagePhotoUrls,
          repair_quote_1_url: repairQuote1Url,
          repair_quote_2_url: repairQuote2Url,
          contractor_report_url: contractorReportUrl,
          location_address: locationAddress || null,
          location_lat: location?.lat || null,
          location_lng: location?.lng || null,
          voice_note_url: voiceNoteUrl,
          voice_transcript_en: voiceTranscript,
        });

      if (insertError) throw insertError;
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
            Your structural damage claim has been successfully submitted. A broker will review your claim and contact you shortly.
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
      <div className="max-w-2xl mx-auto p-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Structural Damage Claim</h1>
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
            {[1, 2, 3, 4, 5, 6].map((s) => (
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
                {s < 6 && (
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
                What caused the damage?
              </h2>
              <p className="text-gray-600 mb-6">
                Select the type of incident
              </p>

              <div className="space-y-3">
                {[
                  { id: 'storm_water', label: 'Storm, Wind, Water or Hail', icon: Cloud },
                  { id: 'fire_explosion', label: 'Fire or Explosion', icon: Flame },
                  { id: 'impact', label: 'Impact (Vehicle, Tree, etc)', icon: AlertTriangle },
                  { id: 'accidental_fixtures', label: 'Accidental Damage to Fixtures', icon: Home },
                  { id: 'theft_fixtures', label: 'Theft of Fixtures', icon: Lock },
                  { id: 'lightning_power_surge', label: 'Lightning/Power Surge', icon: Zap },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setIncidentType(id as IncidentType);
                      if (id === 'lightning_power_surge') {
                        setStep(2);
                      } else {
                        setStep(2);
                      }
                    }}
                    className={`w-full p-4 border-2 rounded-lg text-left transition-all flex items-center ${
                      incidentType === id
                        ? 'border-blue-700 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <Icon className="w-6 h-6 text-blue-700 mr-3 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900">{label}</p>
                      {id === 'storm_water' && <p className="text-xs text-gray-600">Most common</p>}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!incidentType}
                className="w-full mt-6 bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Urgency & Safety Assessment
              </h2>
              <p className="text-gray-600 mb-6">
                Help us understand the severity
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Is the home currently habitable? *
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setIsHabitable(true)}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        isHabitable === true
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">Yes, habitable</p>
                    </button>
                    <button
                      onClick={() => setIsHabitable(false)}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        isHabitable === false
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">No, not habitable</p>
                    </button>
                  </div>
                  {isHabitable === false && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                      <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-700">
                        This claim is URGENT. Our team will contact you regarding emergency accommodation.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Is the property secure? *
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setIsPropertySecure(true)}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        isPropertySecure === true
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">Yes, property is secure</p>
                    </button>
                    <button
                      onClick={() => {
                        setIsPropertySecure(false);
                        setSecurityGuardRequested(true);
                      }}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        isPropertySecure === false
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">No, not secure</p>
                    </button>
                  </div>
                  {securityGuardRequested && (
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start">
                      <AlertCircle className="w-5 h-5 text-orange-600 mr-2 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-orange-700">
                        A security guard has been requested. Our team will arrange this shortly.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (incidentType === 'lightning_power_surge') {
                      setStep(3);
                    } else if (incidentType === 'storm_water') {
                      setStep(3);
                    } else if (incidentType === 'accidental_fixtures') {
                      setStep(3);
                    } else if (incidentType === 'fire_explosion' || incidentType === 'impact') {
                      setStep(4);
                    } else {
                      setStep(4);
                    }
                  }}
                  disabled={isHabitable === null || isPropertySecure === null}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && incidentType === 'storm_water' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Storm/Water Specifics
              </h2>
              <p className="text-gray-600 mb-6">
                Where did the water enter your property?
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Entry point *
                  </label>
                  <div className="space-y-2">
                    {WATER_ENTRY_POINTS.map((point) => (
                      <button
                        key={point}
                        onClick={() => setWaterEntryPoint(point)}
                        className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                          waterEntryPoint === point
                            ? 'border-blue-700 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <p className="font-semibold text-gray-900">{point}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Is this damage due to a single event or gradual leak? *
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setIsGradualLeak(false)}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        isGradualLeak === false
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">Single storm event</p>
                    </button>
                    <button
                      onClick={() => setIsGradualLeak(true)}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        isGradualLeak === true
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">Gradual leaks over time</p>
                    </button>
                  </div>
                  {isGradualLeak === true && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start">
                      <AlertCircle className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-700">
                        Note: Insurance covers sudden events. Maintenance-related damp may be rejected.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setStep(4)}
                  disabled={!waterEntryPoint || isGradualLeak === null}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && incidentType === 'accidental_fixtures' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Damage Type
              </h2>
              <p className="text-gray-600 mb-6">
                Is this purely for Glass damage?
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setIsGlassOnly(true);
                    setStep(5);
                  }}
                  className="w-full p-4 border-2 border-gray-200 hover:border-blue-300 rounded-lg text-left transition-all"
                >
                  <p className="font-semibold text-gray-900">Yes, just glass (windows/doors)</p>
                  <p className="text-xs text-gray-600">Skip to quote step</p>
                </button>
                <button
                  onClick={() => {
                    setIsGlassOnly(false);
                    setStep(4);
                  }}
                  className="w-full p-4 border-2 border-gray-200 hover:border-blue-300 rounded-lg text-left transition-all"
                >
                  <p className="font-semibold text-gray-900">No, other accidental damage</p>
                  <p className="text-xs text-gray-600">Continue to next step</p>
                </button>
              </div>
            </div>
          )}

          {step === 3 && incidentType === 'lightning_power_surge' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Lightning/Power Surge Damage
              </h2>
              <p className="text-gray-600 mb-6">
                What type of items were damaged?
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setLightningSubType('fixed_items');
                    setStep(4);
                  }}
                  className="w-full p-4 border-2 border-gray-200 hover:border-blue-300 rounded-lg text-left transition-all"
                >
                  <p className="font-semibold text-gray-900">Fixed items</p>
                  <p className="text-sm text-gray-600">Gate motor, alarm board, pool pump, etc.</p>
                </button>
                <button
                  onClick={() => {
                    setLightningSubType('movable_items');
                    setStep(4);
                  }}
                  className="w-full p-4 border-2 border-gray-200 hover:border-blue-300 rounded-lg text-left transition-all"
                >
                  <p className="font-semibold text-gray-900">Movable items</p>
                  <p className="text-sm text-gray-600">TV, fridge, appliances, etc.</p>
                </button>
              </div>
            </div>
          )}

          {step === 4 && !isGlassOnly && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Bond Holder Details
              </h2>
              <p className="text-gray-600 mb-6">
                Is the property bonded?
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Is the property bonded? *
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setIsBonded(true)}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        isBonded === true
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">Yes</p>
                    </button>
                    <button
                      onClick={() => setIsBonded(false)}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        isBonded === false
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">No</p>
                    </button>
                  </div>
                </div>

                {isBonded === true && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Which Bank? *
                    </label>
                    <select
                      value={bondBank}
                      onChange={(e) => setBondBank(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a bank</option>
                      {BANKS.map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={() => setStep(5)}
                  disabled={isBonded === null || (isBonded && !bondBank)}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 4 && (incidentType === 'fire_explosion' || incidentType === 'impact') && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {incidentType === 'fire_explosion' ? 'Roof Information' : 'Additional Details'}
              </h2>
              {incidentType === 'fire_explosion' && (
                <p className="text-gray-600 mb-6">
                  What is your roof construction?
                </p>
              )}

              <div className="space-y-6">
                {incidentType === 'fire_explosion' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Roof construction *
                    </label>
                    <div className="space-y-2">
                      {ROOF_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => setRoofConstruction(type)}
                          className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                            roofConstruction === type
                              ? 'border-blue-700 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <p className="font-semibold text-gray-900">{type}</p>
                        </button>
                      ))}
                    </div>
                    {roofConstruction === 'Thatch' && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                        <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-700">
                          High Risk/Complexity flagged. Broker will review this claim carefully.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setStep(5)}
                  disabled={incidentType === 'fire_explosion' && !roofConstruction}
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
                Evidence & Quotes
              </h2>
              <p className="text-gray-600 mb-6">
                Provide repair estimates and damage photos
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Cost of Repairs (R) *
                  </label>
                  <input
                    type="number"
                    value={estimatedRepairCost}
                    onChange={(e) => setEstimatedRepairCost(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                  {estimatedRepairCost && parseFloat(estimatedRepairCost) > 50000 && isBonded !== null && (
                    <p className="text-xs text-orange-600 mt-2">
                      Bank notification may be required for claims over R50,000
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Damage Photos (Wide & Close-up) *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setDamagePhotos(Array.from(e.target.files || []))}
                      className="hidden"
                      id="damage-photos"
                    />
                    <label htmlFor="damage-photos" className="cursor-pointer">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {damagePhotos.length > 0
                          ? `${damagePhotos.length} photo(s) selected`
                          : 'Tap to upload damage photos'}
                      </p>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Repair Quote 1 (PDF) *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setRepairQuote1(e.target.files?.[0] || null)}
                      className="hidden"
                      id="quote-1"
                    />
                    <label htmlFor="quote-1" className="cursor-pointer">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {repairQuote1 ? repairQuote1.name : 'Tap to upload quote'}
                      </p>
                    </label>
                  </div>
                </div>

                {estimatedRepairCost && parseFloat(estimatedRepairCost) > 20000 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Repair Quote 2 (PDF) *
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setRepairQuote2(e.target.files?.[0] || null)}
                        className="hidden"
                        id="quote-2"
                      />
                      <label htmlFor="quote-2" className="cursor-pointer">
                        <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          {repairQuote2 ? repairQuote2.name : 'Tap to upload second quote'}
                        </p>
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contractor Report (Optional)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setContractorReport(e.target.files?.[0] || null)}
                      className="hidden"
                      id="report"
                    />
                    <label htmlFor="report" className="cursor-pointer">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {contractorReport ? contractorReport.name : 'Tap to upload report'}
                      </p>
                    </label>
                  </div>
                </div>

                <button
                  onClick={() => setStep(6)}
                  disabled={
                    !estimatedRepairCost ||
                    damagePhotos.length === 0 ||
                    !repairQuote1 ||
                    (parseFloat(estimatedRepairCost) > 20000 && !repairQuote2)
                  }
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Voice Statement
              </h2>
              <p className="text-gray-600 mb-6">
                Record a detailed voice note describing the damage and incident
              </p>

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

              <button
                onClick={submitClaim}
                disabled={!audioBlob || loading}
                className="w-full mt-6 bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center"
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
          )}
        </div>
      </div>
    </div>
  );
}
