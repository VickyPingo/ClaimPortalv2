import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { submitClaimUnified } from '../lib/claimSubmission';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  MapPin,
  Mic,
  StopCircle,
  Upload,
  X,
} from 'lucide-react';

type Step = 1 | 2 | 3 | 4 | 'success';

interface BurstGeyserFormProps {
  clientId?: string;
  brokerageId: string;
  onBack: () => void;
}

const GEYSER_TYPES = ['Electric', 'Gas', 'Solar'];

export default function BurstGeyserForm({
  clientId,
  brokerageId,
  onBack,
}: BurstGeyserFormProps) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState('');

  const [burstDate, setBurstDate] = useState('');
  const [burstTime, setBurstTime] = useState('');
  const [geyserType, setGeyserType] = useState('');
  const [hasResultingDamage, setHasResultingDamage] = useState<boolean | null>(null);

  const [damagePhotos, setDamagePhotos] = useState<File[]>([]);
  const [repairQuote, setRepairQuote] = useState<File | null>(null);
  const [estimatedRepairCost, setEstimatedRepairCost] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [extraAudioBlob, setExtraAudioBlob] = useState<Blob | null>(null);
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

  const startRecording = async (isExtra: boolean = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (isExtra) {
          setExtraAudioBlob(blob);
        } else {
          setAudioBlob(blob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setDamagePhotos([...damagePhotos, ...newFiles]);
    }
  };

  const removePhoto = (index: number) => {
    setDamagePhotos(damagePhotos.filter((_, i) => i !== index));
  };

  const handleRepairQuoteSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setRepairQuote(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!burstDate || !burstTime || !geyserType || hasResultingDamage === null) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('[GeyserClaim] Starting submission');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, cell_number')
        .eq('user_id', user.id)
        .maybeSingle();

      const timestamp = Date.now();
      const uploadDir = `${user.id}/${timestamp}`;

      const uploadFile = async (file: File, path: string): Promise<string> => {
        const { data, error } = await supabase.storage
          .from('claims')
          .upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage
          .from('claims')
          .getPublicUrl(data.path);
        return urlData.publicUrl;
      };

      const attachments: Array<{
        bucket: string;
        path: string;
        url: string;
        kind: string;
        label: string;
      }> = [];

      for (let i = 0; i < damagePhotos.length; i++) {
        const path = `${uploadDir}/damage_photo_${i + 1}.jpg`;
        const url = await uploadFile(damagePhotos[i], path);
        attachments.push({ bucket: 'claims', path, url, kind: 'damage_photo', label: `Damage Photo ${i + 1}` });
      }

      if (audioBlob) {
        const path = `${uploadDir}/voice_note.webm`;
        const file = new File([audioBlob], 'voice_note.webm', { type: 'audio/webm' });
        const url = await uploadFile(file, path);
        attachments.push({ bucket: 'claims', path, url, kind: 'voice_note', label: 'Voice Description' });
      }

      if (extraAudioBlob) {
        const path = `${uploadDir}/extra_voice_note.webm`;
        const file = new File([extraAudioBlob], 'extra_voice_note.webm', { type: 'audio/webm' });
        const url = await uploadFile(file, path);
        attachments.push({ bucket: 'claims', path, url, kind: 'extra_voice_note', label: 'Additional Voice Note' });
      }

      if (repairQuote) {
        const path = `${uploadDir}/repair_quote.pdf`;
        const url = await uploadFile(repairQuote, path);
        attachments.push({ bucket: 'claims', path, url, kind: 'repair_quote', label: 'Repair Quote' });
      }

      const claimData = {
        burst_datetime: `${burstDate}T${burstTime}`,
        geyser_type: geyserType.toLowerCase(),
        has_resulting_damage: hasResultingDamage,
        location_address: locationAddress,
        location_lat: location?.lat || null,
        location_lng: location?.lng || null,
        estimated_repair_cost: estimatedRepairCost ? parseFloat(estimatedRepairCost) : null,
      };

      console.log('[GeyserClaim] Submitting with', attachments.length, 'attachments');

      await submitClaimUnified({
        claimType: 'burst_geyser',
        claimData,
        attachments,
      });

      console.log('[GeyserClaim] Submission successful');
      setStep('success');
    } catch (err: any) {
      console.error('[GeyserClaim] Submission error:', err);
      setError(err.message || 'Failed to submit claim');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Claim Submitted</h2>
          <p className="text-gray-600 mb-6">
            Your burst geyser claim has been successfully submitted. Our team will review it and contact you shortly.
          </p>
          <button
            onClick={onBack}
            className="w-full bg-blue-700 text-white py-2 rounded-lg hover:bg-blue-800 font-semibold"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="flex-1 h-2 bg-gray-200 rounded-full">
              <div
                className="h-full bg-blue-700 rounded-full transition-all"
                style={{ width: `${(Object.keys({ 1: 1, 2: 1, 3: 1, 4: 1 }).indexOf(String(step)) + 1) * 25}%` }}
              ></div>
            </div>
            <span className="text-sm font-semibold text-gray-700">
              Step {Object.keys({ 1: 1, 2: 1, 3: 1, 4: 1 }).indexOf(String(step)) + 1} of 4
            </span>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {step === 1 && 'When did the geyser burst?'}
            {step === 2 && 'Geyser Details'}
            {step === 3 && 'Damage & Documentation'}
            {step === 4 && 'Review & Submit'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Burst *
                </label>
                <input
                  type="date"
                  value={burstDate}
                  onChange={(e) => setBurstDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time of Burst *
                </label>
                <input
                  type="time"
                  value={burstTime}
                  onChange={(e) => setBurstTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">
                      {locationAddress || 'Detecting location...'}
                    </p>
                    {location && (
                      <p className="text-xs text-gray-400">
                        {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full bg-blue-700 text-white py-2 rounded-lg hover:bg-blue-800 font-semibold"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type of Geyser *
                </label>
                <div className="space-y-2">
                  {GEYSER_TYPES.map((type) => (
                    <label key={type} className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="geyserType"
                        value={type}
                        checked={geyserType === type}
                        onChange={(e) => setGeyserType(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="font-medium text-gray-700">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Did the burst cause damage to property? *
                </label>
                <div className="space-y-2">
                  {[
                    { value: true, label: 'Yes, there is damage' },
                    { value: false, label: 'No, no additional damage' },
                  ].map(({ value, label }) => (
                    <label key={String(value)} className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="damageCaused"
                        checked={hasResultingDamage === value}
                        onChange={() => setHasResultingDamage(value)}
                        className="w-4 h-4"
                      />
                      <span className="font-medium text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Describe what happened (Optional)
                </label>
                <button
                  onClick={() => startRecording(false)}
                  disabled={isRecording}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Mic className="w-5 h-5" />
                  {isRecording ? 'Recording...' : 'Record Voice Note'}
                </button>
                {isRecording && (
                  <button
                    onClick={stopRecording}
                    className="w-full mt-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center justify-center gap-2"
                  >
                    <StopCircle className="w-5 h-5" />
                    Stop Recording
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-semibold"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Damage Photos (Optional)
                </label>
                <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Click to upload photos</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>

                {damagePhotos.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {damagePhotos.map((photo, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700 truncate">{photo.name}</span>
                        <button
                          onClick={() => removePhoto(i)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Repair Cost (R) (Optional)
                </label>
                <input
                  type="number"
                  value={estimatedRepairCost}
                  onChange={(e) => setEstimatedRepairCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repair Quote (PDF) (Optional)
                </label>
                <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Click to upload PDF</span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleRepairQuoteSelect}
                    className="hidden"
                  />
                </label>
                {repairQuote && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-gray-700">{repairQuote.name}</span>
                    <button
                      onClick={() => setRepairQuote(null)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <button
                  onClick={() => startRecording(true)}
                  disabled={isRecording}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Mic className="w-5 h-5" />
                  {isRecording ? 'Recording...' : 'Record Extra Notes'}
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-semibold"
                >
                  Review
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Burst Date & Time:</span>
                  <span className="font-semibold">{burstDate} {burstTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Geyser Type:</span>
                  <span className="font-semibold">{geyserType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Property Damage:</span>
                  <span className="font-semibold">{hasResultingDamage ? 'Yes' : 'No'}</span>
                </div>
                {estimatedRepairCost && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Est. Repair Cost:</span>
                    <span className="font-semibold">R{parseFloat(estimatedRepairCost).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-semibold text-right text-sm">{locationAddress}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Claim
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
