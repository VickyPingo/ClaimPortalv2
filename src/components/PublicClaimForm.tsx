import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Car,
  Droplet,
  Camera,
  Video,
  Mic,
  MapPin,
  Loader2,
  CheckCircle,
  ArrowLeft,
  AlertCircle,
  Shield,
  Home,
  Briefcase,
} from 'lucide-react';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 'success';
type IncidentType = 'motor_accident' | 'burst_geyser' | null;
type CarCondition = 'drivable' | 'not_drivable' | null;

interface PublicClaimFormProps {
  onBack: () => void;
  onTheftClaim: () => void;
  onMotorVehicleTheft: () => void;
  onStructuralDamage: () => void;
  onAllRisk: () => void;
}

const SA_PROVINCES = {
  'Eastern Cape': ['Port Elizabeth', 'East London', 'Mthatha', 'Graaff-Reinet', 'Uitenhage'],
  'Free State': ['Bloemfontein', 'Welkom', 'Bethlehem', 'Kroonstad', 'Sasolburg'],
  'Gauteng': ['Johannesburg', 'Pretoria', 'Sandton', 'Centurion', 'Midrand', 'Randburg', 'Roodepoort', 'Boksburg', 'Benoni', 'Germiston'],
  'KwaZulu-Natal': ['Durban', 'Pietermaritzburg', 'Richards Bay', 'Newcastle', 'Ladysmith'],
  'Limpopo': ['Polokwane', 'Tzaneen', 'Thohoyandou', 'Phalaborwa', 'Mokopane'],
  'Mpumalanga': ['Nelspruit', 'Witbank', 'Middelburg', 'Secunda', 'Ermelo'],
  'Northern Cape': ['Kimberley', 'Upington', 'Springbok', 'De Aar', 'Kuruman'],
  'North West': ['Rustenburg', 'Mahikeng', 'Klerksdorp', 'Potchefstroom', 'Brits'],
  'Western Cape': ['Cape Town', 'Stellenbosch', 'George', 'Paarl', 'Worcester', 'Mossel Bay', 'Somerset West']
};

export default function PublicClaimForm({ onBack, onTheftClaim, onMotorVehicleTheft, onStructuralDamage, onAllRisk }: PublicClaimFormProps) {
  const [step, setStep] = useState<Step>(1);
  const [incidentType, setIncidentType] = useState<IncidentType>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState('');

  const [claimantName, setClaimantName] = useState('');
  const [claimantPhone, setClaimantPhone] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');

  const [accidentDateTime, setAccidentDateTime] = useState('');
  const [carCondition, setCarCondition] = useState<CarCondition>(null);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  const [driverLicensePhoto, setDriverLicensePhoto] = useState<File | null>(null);
  const [licenseDiskPhoto, setLicenseDiskPhoto] = useState<File | null>(null);

  const [thirdPartyLicensePhoto, setThirdPartyLicensePhoto] = useState<File | null>(null);
  const [thirdPartyDiskPhoto, setThirdPartyDiskPhoto] = useState<File | null>(null);

  const [damagePhotos, setDamagePhotos] = useState<File[]>([]);

  const [leakVideo, setLeakVideo] = useState<File | null>(null);
  const [serialPhoto, setSerialPhoto] = useState<File | null>(null);

  const [burstDateTime, setBurstDateTime] = useState('');
  const [geyserType, setGeyserType] = useState<'electric' | 'gas' | 'solar' | null>(null);
  const [hasResultingDamage, setHasResultingDamage] = useState<boolean | null>(null);
  const [geyserLocationAddress, setGeyserLocationAddress] = useState('');
  const [geyserDamagePhotos, setGeyserDamagePhotos] = useState<File[]>([]);

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
    if (!incidentType) return;

    setLoading(true);
    try {
      const timestamp = Date.now();
      const tempId = `anonymous_${timestamp}`;

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

      if (incidentType === 'motor_accident') {
        const damagePhotoUrls = [];

        for (let i = 0; i < damagePhotos.length; i++) {
          damagePhotoUrls.push(
            await uploadFile(damagePhotos[i], 'claims', `${tempId}/${timestamp}/damage_${i + 1}.jpg`)
          );
        }

        const driverLicenseUrl = driverLicensePhoto
          ? await uploadFile(driverLicensePhoto, 'claims', `${tempId}/${timestamp}/driver_license.jpg`)
          : null;

        const licenseDiskUrl = licenseDiskPhoto
          ? await uploadFile(licenseDiskPhoto, 'claims', `${tempId}/${timestamp}/license_disk.jpg`)
          : null;

        const thirdPartyLicenseUrl = thirdPartyLicensePhoto
          ? await uploadFile(thirdPartyLicensePhoto, 'claims', `${tempId}/${timestamp}/third_party_license.jpg`)
          : null;

        const thirdPartyDiskUrl = thirdPartyDiskPhoto
          ? await uploadFile(thirdPartyDiskPhoto, 'claims', `${tempId}/${timestamp}/third_party_disk.jpg`)
          : null;

        const panelBeaterLocation = selectedProvince && selectedCity
          ? `${selectedCity}, ${selectedProvince}`
          : null;

        const { data: claimData, error: insertError } = await supabase.from('claims').insert({
          brokerage_id: '00000000-0000-0000-0000-000000000001',
          client_id: null,
          claimant_name: claimantName,
          claimant_phone: claimantPhone,
          claimant_email: claimantEmail,
          incident_type: incidentType,
          accident_date_time: accidentDateTime || null,
          location_lat: location?.lat || null,
          location_lng: location?.lng || null,
          location_address: locationAddress || null,
          car_condition: carCondition,
          panel_beater_location: panelBeaterLocation,
          driver_license_photo_url: driverLicenseUrl,
          license_disk_photo_url: licenseDiskUrl,
          third_party_license_photo_url: thirdPartyLicenseUrl,
          third_party_disk_photo_url: thirdPartyDiskUrl,
          damage_photo_urls: damagePhotoUrls,
          voice_note_url: voiceNoteUrl,
          voice_transcript_en: voiceTranscript,
          media_urls: [],
          third_party_details: null,
        }).select().single();

        if (insertError) throw insertError;
      } else if (incidentType === 'burst_geyser') {
        const mediaUrls: string[] = [];

        if (leakVideo) {
          const url = await uploadFile(
            leakVideo,
            'claims',
            `${tempId}/${timestamp}/leak_video.mp4`
          );
          mediaUrls.push(url);
        }
        if (serialPhoto) {
          const url = await uploadFile(
            serialPhoto,
            'claims',
            `${tempId}/${timestamp}/serial.jpg`
          );
          mediaUrls.push(url);
        }

        for (let i = 0; i < geyserDamagePhotos.length; i++) {
          const url = await uploadFile(
            geyserDamagePhotos[i],
            'claims',
            `${tempId}/${timestamp}/damage_photo_${i + 1}.jpg`
          );
          mediaUrls.push(url);
        }

        const { data: claimData, error: insertError } = await supabase.from('claims').insert({
          brokerage_id: '00000000-0000-0000-0000-000000000001',
          client_id: null,
          claimant_name: claimantName,
          claimant_phone: claimantPhone,
          claimant_email: claimantEmail,
          incident_type: incidentType,
          location_lat: location?.lat || null,
          location_lng: location?.lng || null,
          location_address: geyserLocationAddress || location ? (geyserLocationAddress || locationAddress) : null,
          burst_datetime: burstDateTime || null,
          geyser_type: geyserType || null,
          has_resulting_damage: hasResultingDamage,
          voice_note_url: voiceNoteUrl,
          voice_transcript_en: voiceTranscript,
          media_urls: mediaUrls,
          third_party_details: null,
        }).select().single();

        if (insertError) throw insertError;
      }

      setStep('success');
    } catch (error: any) {
      alert('Failed to submit claim: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStepCount = () => {
    if (incidentType === 'motor_accident') return 6;
    if (incidentType === 'burst_geyser') return 6;
    return 4;
  };

  const getMotorAccidentStepContent = () => {
    if (step === 3) {
      return (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Accident Details
          </h2>
          <p className="text-gray-600 mb-6">
            Provide details about when and where the accident occurred
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date and Time of Accident *
              </label>
              <input
                type="datetime-local"
                value={accidentDateTime}
                onChange={(e) => setAccidentDateTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <div className="space-y-3">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start mb-2">
                    <MapPin className="w-5 h-5 text-gray-600 mr-2 mt-0.5" />
                    <div className="flex-1">
                      {location ? (
                        <>
                          <p className="text-sm text-gray-700">
                            {locationAddress || 'Fetching address...'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">Location unavailable</p>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={locationAddress}
                    onChange={(e) => setLocationAddress(e.target.value)}
                    placeholder="Enter or edit street address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                {location && (
                  <div className="w-full h-48 rounded-lg overflow-hidden border border-gray-300">
                    <iframe
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      style={{ border: 0 }}
                      src={`https://www.google.com/maps?q=${location.lat},${location.lng}&hl=en&z=15&output=embed`}
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Car Condition *
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setCarCondition('drivable')}
                  className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                    carCondition === 'drivable'
                      ? 'border-blue-700 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <p className="font-semibold text-gray-900">Drivable</p>
                  <p className="text-sm text-gray-600">Vehicle can be driven safely</p>
                </button>
                <button
                  onClick={() => setCarCondition('not_drivable')}
                  className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                    carCondition === 'not_drivable'
                      ? 'border-blue-700 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <p className="font-semibold text-gray-900">Not Drivable</p>
                  <p className="text-sm text-gray-600">Vehicle needs to be towed</p>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Panel Beater Province *
              </label>
              <select
                value={selectedProvince}
                onChange={(e) => {
                  setSelectedProvince(e.target.value);
                  setSelectedCity('');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a province</option>
                {Object.keys(SA_PROVINCES).map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </div>

            {selectedProvince && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Panel Beater City *
                </label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a city</option>
                  {SA_PROVINCES[selectedProvince as keyof typeof SA_PROVINCES].map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setStep(4)}
              disabled={!accidentDateTime || !carCondition || !selectedProvince || !selectedCity}
              className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    if (step === 4) {
      return (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Driver & Vehicle Documentation
          </h2>
          <p className="text-gray-600 mb-6">
            Upload photos of your driver's license and vehicle license disk
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Driver's License Photo *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDriverLicensePhoto(e.target.files?.[0] || null)}
                  className="hidden"
                  id="driver-license"
                />
                <label htmlFor="driver-license" className="cursor-pointer">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    {driverLicensePhoto ? driverLicensePhoto.name : 'Tap to upload driver\'s license'}
                  </p>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle License Disk Photo *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLicenseDiskPhoto(e.target.files?.[0] || null)}
                  className="hidden"
                  id="license-disk"
                />
                <label htmlFor="license-disk" className="cursor-pointer">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    {licenseDiskPhoto ? licenseDiskPhoto.name : 'Tap to upload license disk'}
                  </p>
                </label>
              </div>
            </div>

            <div className="my-6 pt-6 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-4">
                If a Third Party was involved please get the following details from him:
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Third Party Driver's License Photo
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThirdPartyLicensePhoto(e.target.files?.[0] || null)}
                  className="hidden"
                  id="third-party-license"
                />
                <label htmlFor="third-party-license" className="cursor-pointer">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    {thirdPartyLicensePhoto ? thirdPartyLicensePhoto.name : 'Tap to upload (optional)'}
                  </p>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Third Party License Disk Photo
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThirdPartyDiskPhoto(e.target.files?.[0] || null)}
                  className="hidden"
                  id="third-party-disk"
                />
                <label htmlFor="third-party-disk" className="cursor-pointer">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    {thirdPartyDiskPhoto ? thirdPartyDiskPhoto.name : 'Tap to upload (optional)'}
                  </p>
                </label>
              </div>
            </div>

            <button
              onClick={() => setStep(5)}
              disabled={!driverLicensePhoto || !licenseDiskPhoto}
              className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    if (step === 5) {
      const addDamagePhoto = (file: File) => {
        setDamagePhotos([...damagePhotos, file]);
      };

      const removeDamagePhoto = (index: number) => {
        setDamagePhotos(damagePhotos.filter((_, i) => i !== index));
      };

      return (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Vehicle Damage Photos
          </h2>
          <p className="text-gray-600 mb-6">
            Upload at least 2 photos showing the damage to your vehicle
          </p>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {damagePhotos.map((photo, index) => (
                <div key={index} className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Damage Photo {index + 1} {index < 2 ? '*' : ''}
                  </label>
                  <div className="border-2 border-solid border-gray-300 rounded-lg p-4 text-center bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1 min-w-0">
                        <Camera className="w-8 h-8 text-green-600 mr-2 flex-shrink-0" />
                        <p className="text-xs text-gray-700 truncate">{photo.name}</p>
                      </div>
                      <button
                        onClick={() => removeDamagePhoto(index)}
                        className="ml-2 text-red-600 hover:text-red-800 flex-shrink-0"
                      >
                        <AlertCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Photo {damagePhotos.length < 2 ? '*' : ''}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        addDamagePhoto(file);
                        e.target.value = '';
                      }
                    }}
                    className="hidden"
                    id="damage-add"
                  />
                  <label htmlFor="damage-add" className="cursor-pointer">
                    <Camera className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-600">Tap to add photo</p>
                  </label>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(6)}
              disabled={damagePhotos.length < 2}
              className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    if (step === 6) {
      return (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Voice Statement
          </h2>
          <p className="text-gray-600 mb-6">
            Record a detailed voice note describing what happened. Your audio will be saved for the broker to review.
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
      );
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Claim Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Your claim has been successfully submitted. A broker will contact you shortly at {claimantPhone || claimantEmail}.
          </p>
          {incidentType === 'motor_accident' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                Next Steps:
              </p>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Visit your nearest police station to file a report</li>
                <li>Obtain a police case number</li>
                <li>Keep this number for your broker</li>
              </ol>
            </div>
          )}
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

  const totalSteps = getStepCount();
  const currentStepNum = typeof step === 'number' ? step : totalSteps;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="max-w-2xl mx-auto p-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">File a Claim</h1>
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
            {Array.from({ length: Math.min(totalSteps, 8) }, (_, i) => i + 1).map((s) => (
              <div key={s} className="flex-1 flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    currentStepNum >= s
                      ? 'bg-blue-700 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s}
                </div>
                {s < Math.min(totalSteps, 8) && (
                  <div
                    className={`flex-1 h-1 mx-1 ${
                      currentStepNum > s ? 'bg-blue-700' : 'bg-gray-200'
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
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Please provide details of the person that can be contacted to handle this claim
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="John Smith"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={claimantPhone}
                    onChange={(e) => setClaimantPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="+27 12 345 6789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address (optional)
                  </label>
                  <input
                    type="email"
                    value={claimantEmail}
                    onChange={(e) => setClaimantEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="john@example.com"
                  />
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!claimantName || !claimantPhone}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && !incidentType && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Choose Incident Type
              </h2>
              <p className="text-gray-600 mb-6">
                What type of incident are you reporting?
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => {
                    setIncidentType('motor_accident');
                    setStep(3);
                  }}
                  className="w-full p-6 border-2 border-gray-200 rounded-lg hover:border-blue-700 hover:bg-blue-50 transition-all text-left"
                >
                  <div className="flex items-start">
                    <Car className="w-8 h-8 text-blue-700 mr-4" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        Motor Accident
                      </h3>
                      <p className="text-sm text-gray-600">
                        Vehicle collision or road incident
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIncidentType('burst_geyser');
                    setStep(3);
                  }}
                  className="w-full p-6 border-2 border-gray-200 rounded-lg hover:border-blue-700 hover:bg-blue-50 transition-all text-left"
                >
                  <div className="flex items-start">
                    <Droplet className="w-8 h-8 text-blue-700 mr-4" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        Burst Geyser
                      </h3>
                      <p className="text-sm text-gray-600">
                        Water heater leak or damage
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={onTheftClaim}
                  className="w-full p-6 border-2 border-green-200 bg-green-50 rounded-lg hover:border-green-700 hover:bg-green-100 transition-all text-left"
                >
                  <div className="flex items-start">
                    <Shield className="w-8 h-8 text-green-700 mr-4" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        Theft Claim
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Property theft or burglary claim
                      </p>
                      <p className="text-xs text-green-700 font-medium">
                        Please sign-in or create an account to file a theft claim
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={onMotorVehicleTheft}
                  className="w-full p-6 border-2 border-orange-200 bg-orange-50 rounded-lg hover:border-orange-700 hover:bg-orange-100 transition-all text-left"
                >
                  <div className="flex items-start">
                    <Car className="w-8 h-8 text-orange-700 mr-4" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        Motor Vehicle Theft
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Report a stolen or hijacked motor vehicle
                      </p>
                      <p className="text-xs text-orange-700 font-medium">
                        Please sign-in or create an account to file a motor vehicle theft claim
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={onStructuralDamage}
                  className="w-full p-6 border-2 border-amber-200 bg-amber-50 rounded-lg hover:border-amber-700 hover:bg-amber-100 transition-all text-left"
                >
                  <div className="flex items-start">
                    <Home className="w-8 h-8 text-amber-700 mr-4" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        Structural Damage
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Storm, water, fire, or impact damage to your property
                      </p>
                      <p className="text-xs text-amber-700 font-medium">
                        Please sign-in or create an account to file a structural damage claim
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={onAllRisk}
                  className="w-full p-6 border-2 border-purple-200 bg-purple-50 rounded-lg hover:border-purple-700 hover:bg-purple-100 transition-all text-left"
                >
                  <div className="flex items-start">
                    <Briefcase className="w-8 h-8 text-purple-700 mr-4" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        All-Risk / Portable Items
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Items lost or damaged outside your home
                      </p>
                      <p className="text-xs text-purple-700 font-medium">
                        Please sign-in or create an account to file an all-risk claim
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {incidentType === 'motor_accident' && getMotorAccidentStepContent()}

          {incidentType === 'burst_geyser' && step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Geyser Incident Details
              </h2>
              <p className="text-gray-600 mb-6">
                Provide information about the burst geyser
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location Address
                  </label>
                  <div className="space-y-3">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start mb-2">
                        <MapPin className="w-5 h-5 text-gray-600 mr-2 mt-0.5" />
                        <div className="flex-1">
                          {location ? (
                            <>
                              <p className="text-sm text-gray-700">
                                {locationAddress || 'Fetching address...'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-gray-500">Location unavailable</p>
                          )}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={geyserLocationAddress}
                        onChange={(e) => setGeyserLocationAddress(e.target.value)}
                        placeholder="Enter or edit street address"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date and Time of Burst *
                  </label>
                  <input
                    type="datetime-local"
                    value={burstDateTime}
                    onChange={(e) => setBurstDateTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Geyser Type *
                  </label>
                  <div className="space-y-2">
                    {['electric', 'gas', 'solar'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setGeyserType(type as 'electric' | 'gas' | 'solar')}
                        className={`w-full p-3 border-2 rounded-lg text-left transition-all capitalize ${
                          geyserType === type
                            ? 'border-blue-700 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <p className="font-semibold text-gray-900">{type}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Are there any resulting damage due to the leak? *
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setHasResultingDamage(true)}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        hasResultingDamage === true
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">Yes</p>
                    </button>
                    <button
                      onClick={() => setHasResultingDamage(false)}
                      className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                        hasResultingDamage === false
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">No</p>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setStep(4)}
                  disabled={!burstDateTime || !geyserType || hasResultingDamage === null}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {incidentType === 'burst_geyser' && step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Geyser Media
              </h2>
              <p className="text-gray-600 mb-6">
                Upload photos and video of the leak and damage
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leak Video
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => setLeakVideo(e.target.files?.[0] || null)}
                      className="hidden"
                      id="leak-video"
                    />
                    <label htmlFor="leak-video" className="cursor-pointer">
                      <Video className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {leakVideo ? leakVideo.name : 'Tap to upload video'}
                      </p>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Serial Number Photo *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSerialPhoto(e.target.files?.[0] || null)}
                      className="hidden"
                      id="serial-photo"
                    />
                    <label htmlFor="serial-photo" className="cursor-pointer">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {serialPhoto ? serialPhoto.name : 'Tap to upload photo'}
                      </p>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Damage Photos
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setGeyserDamagePhotos(Array.from(e.target.files || []))}
                      className="hidden"
                      id="damage-photos"
                    />
                    <label htmlFor="damage-photos" className="cursor-pointer">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {geyserDamagePhotos.length > 0
                          ? `${geyserDamagePhotos.length} photo(s) selected`
                          : 'Tap to upload damage photos'}
                      </p>
                    </label>
                  </div>
                  {geyserDamagePhotos.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      {geyserDamagePhotos.map((file) => (
                        <p key={file.name}>{file.name}</p>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setStep(5)}
                  disabled={!serialPhoto}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {incidentType === 'burst_geyser' && step === 5 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Main Voice Statement
              </h2>
              <p className="text-gray-600 mb-6">
                Record a voice note describing the incident. Your audio will be saved for the broker to review.
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
                onClick={() => setStep(6)}
                disabled={!audioBlob}
                className="w-full mt-6 bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {incidentType === 'burst_geyser' && step === 6 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Review & Submit</h2>
              <p className="text-gray-600 mb-6">
                Please review your claim details before submitting
              </p>

              <div className="space-y-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Contact Person</p>
                  <p className="font-semibold">{claimantName}</p>
                  <p className="text-sm text-gray-700">{claimantPhone}</p>
                  {claimantEmail && <p className="text-sm text-gray-700">{claimantEmail}</p>}
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Incident Type</p>
                  <p className="font-semibold">Burst Geyser</p>
                </div>

                {location && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Location</p>
                    <div className="flex items-center text-sm">
                      <MapPin className="w-4 h-4 text-gray-600 mr-2" />
                      <span>
                        {locationAddress || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Media</p>
                  <p className="font-semibold">1 video, 1 photo</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Voice Statement</p>
                  <p className="font-semibold">Recorded</p>
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
          )}
        </div>
      </div>
    </div>
  );
}
