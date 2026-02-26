import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import TheftClaimForm from './TheftClaimForm';
import MotorVehicleTheftForm from './MotorVehicleTheftForm';
import StructuralDamageForm from './StructuralDamageForm';
import AllRiskForm from './AllRiskForm';
import ClientPastClaims from './ClientPastClaims';
import ClientClaimDetail from './ClientClaimDetail';
import {
  Car,
  Droplet,
  Camera,
  Video,
  Mic,
  MapPin,
  Loader2,
  CheckCircle,
  LogOut,
  AlertCircle,
  Shield,
  ArrowLeft,
  CarFront,
  Home,
  Briefcase,
  History,
} from 'lucide-react';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 'success';
type IncidentType = 'motor_accident' | 'burst_geyser' | null;
type CarCondition = 'drivable' | 'not_drivable' | null;
type ViewMode = 'home' | 'past-claims' | 'claim-detail';

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

const PANEL_BEATER_LOCATIONS = [
  'Johannesburg - Sandton',
  'Johannesburg - Roodepoort',
  'Pretoria - Centurion',
  'Cape Town - Central',
  'Durban - Umhlanga',
  'Port Elizabeth - Central',
  'Bloemfontein - Central',
  'Polokwane - Central',
  'Nelspruit - Central',
];

type ClaimType = 'motor' | 'geyser' | 'theft' | 'motor_vehicle_theft' | 'structural_damage' | 'all_risk' | null;

export default function ClientPortal() {
  const { user, signOut } = useAuth();
  const [claimType, setClaimType] = useState<ClaimType>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [step, setStep] = useState<Step>(1);
  const [incidentType, setIncidentType] = useState<IncidentType>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchClientData();
    }
  }, [user]);

  const fetchClientData = async () => {
    let { data } = await supabase
      .from('clients')
      .select('id, brokerage_id')
      .eq('id', user?.id)
      .maybeSingle();

    if (!data) {
      const profileResponse = await supabase
        .from('client_profiles')
        .select('id, brokerage_id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (profileResponse.data) {
        data = profileResponse.data;
      }
    }

    setClientData(data);
  };

  const [accidentDateTime, setAccidentDateTime] = useState('');
  const [carCondition, setCarCondition] = useState<CarCondition>(null);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [panelBeaterLocation, setPanelBeaterLocation] = useState('');
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [thirdPartyPhone, setThirdPartyPhone] = useState('');
  const [thirdPartyVehicle, setThirdPartyVehicle] = useState('');

  const [driverLicensePhoto, setDriverLicensePhoto] = useState<File | null>(null);
  const [licenseDiskPhoto, setLicenseDiskPhoto] = useState<File | null>(null);

  const [thirdPartyLicensePhoto, setThirdPartyLicensePhoto] = useState<File | null>(null);
  const [thirdPartyDiskPhoto, setThirdPartyDiskPhoto] = useState<File | null>(null);

  const [damagePhoto1, setDamagePhoto1] = useState<File | null>(null);
  const [damagePhoto2, setDamagePhoto2] = useState<File | null>(null);
  const [damagePhoto3, setDamagePhoto3] = useState<File | null>(null);
  const [damagePhoto4, setDamagePhoto4] = useState<File | null>(null);

  const [leakVideo, setLeakVideo] = useState<File | null>(null);
  const [serialPhoto, setSerialPhoto] = useState<File | null>(null);

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
    if (!user || !incidentType) return;

    setLoading(true);
    try {
      const profileData = await supabase
        .from('client_profiles')
        .select('id, brokerage_id, cell_number, full_name, email, policy_number')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profileData.data) {
        console.error('Profile lookup failed for user:', user.id);
        throw new Error('Profile not found. Please complete your profile or contact support.');
      }

      const claimantName = profileData.data.full_name || 'Unknown';
      const policyNumber = profileData.data.policy_number || '';
      const claimantPhone = profileData.data.cell_number || '';
      const claimantEmail = profileData.data.email || '';

      let clientData = await supabase
        .from('clients')
        .select('id, brokerage_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!clientData.data) {
        const { error: insertError } = await supabase
          .from('clients')
          .insert({
            id: profileData.data.id,
            brokerage_id: profileData.data.brokerage_id,
            phone: profileData.data.cell_number,
            name: profileData.data.full_name,
          });

        if (insertError) {
          console.error('Failed to create client record:', insertError);
        }

        clientData = {
          data: {
            id: profileData.data.id,
            brokerage_id: profileData.data.brokerage_id,
          },
          error: null,
        };
      }

      const timestamp = Date.now();

      let voiceNoteUrl = null;
      let voiceTranscript = null;

      if (audioBlob) {
        const audioFile = new File([audioBlob], 'voice_note.webm', {
          type: 'audio/webm',
        });
        voiceNoteUrl = await uploadFile(
          audioFile,
          'claims',
          `${user.id}/${timestamp}/voice_note.webm`
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

        if (damagePhoto1) {
          damagePhotoUrls.push(await uploadFile(damagePhoto1, 'claims', `${user.id}/${timestamp}/damage_1.jpg`));
        }
        if (damagePhoto2) {
          damagePhotoUrls.push(await uploadFile(damagePhoto2, 'claims', `${user.id}/${timestamp}/damage_2.jpg`));
        }
        if (damagePhoto3) {
          damagePhotoUrls.push(await uploadFile(damagePhoto3, 'claims', `${user.id}/${timestamp}/damage_3.jpg`));
        }
        if (damagePhoto4) {
          damagePhotoUrls.push(await uploadFile(damagePhoto4, 'claims', `${user.id}/${timestamp}/damage_4.jpg`));
        }

        const driverLicenseUrl = driverLicensePhoto
          ? await uploadFile(driverLicensePhoto, 'claims', `${user.id}/${timestamp}/driver_license.jpg`)
          : null;

        const licenseDiskUrl = licenseDiskPhoto
          ? await uploadFile(licenseDiskPhoto, 'claims', `${user.id}/${timestamp}/license_disk.jpg`)
          : null;

        const thirdPartyLicenseUrl = thirdPartyLicensePhoto
          ? await uploadFile(thirdPartyLicensePhoto, 'claims', `${user.id}/${timestamp}/third_party_license.jpg`)
          : null;

        const thirdPartyDiskUrl = thirdPartyDiskPhoto
          ? await uploadFile(thirdPartyDiskPhoto, 'claims', `${user.id}/${timestamp}/third_party_disk.jpg`)
          : null;

        const panelBeaterLocation = selectedProvince && selectedCity
          ? `${selectedCity}, ${selectedProvince}`
          : null;

        const thirdPartyDetails = (thirdPartyName || thirdPartyPhone || thirdPartyVehicle)
          ? {
              name: thirdPartyName || '',
              phone: thirdPartyPhone || '',
              vehicle: thirdPartyVehicle || '',
            }
          : null;

        const completeClaimData = {
          accident_date_time: accidentDateTime || null,
          location_address: locationAddress || null,
          location_lat: location?.lat || null,
          location_lng: location?.lng || null,
          car_condition: carCondition,
          panel_beater_location: panelBeaterLocation,
          third_party_details: thirdPartyDetails,
          voice_transcript: voiceTranscript || null,
        };

        const { error: insertError } = await supabase.from('claims').insert({
          brokerage_id: clientData.data.brokerage_id,
          user_id: user.id,
          client_id: user.id,
          incident_type: incidentType,
          claimant_name: claimantName,
          policy_number: policyNumber,
          claimant_phone: claimantPhone,
          claimant_email: claimantEmail,
          claim_data: completeClaimData,
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
          third_party_details: thirdPartyDetails,
        });

        if (insertError) throw insertError;
      } else if (incidentType === 'burst_geyser') {
        const mediaUrls: string[] = [];

        if (leakVideo) {
          const url = await uploadFile(
            leakVideo,
            'claims',
            `${user.id}/${timestamp}/leak_video.mp4`
          );
          mediaUrls.push(url);
        }
        if (serialPhoto) {
          const url = await uploadFile(
            serialPhoto,
            'claims',
            `${user.id}/${timestamp}/serial.jpg`
          );
          mediaUrls.push(url);
        }

        const completeClaimData = {
          location_address: locationAddress || null,
          location_lat: location?.lat || null,
          location_lng: location?.lng || null,
          voice_transcript: voiceTranscript || null,
          media_count: mediaUrls.length,
        };

        const { error: insertError } = await supabase.from('claims').insert({
          brokerage_id: clientData.data.brokerage_id,
          user_id: user.id,
          client_id: user.id,
          incident_type: incidentType,
          claimant_name: claimantName,
          policy_number: policyNumber,
          claimant_phone: claimantPhone,
          claimant_email: claimantEmail,
          claim_data: completeClaimData,
          location_lat: location?.lat || null,
          location_lng: location?.lng || null,
          location_address: locationAddress || null,
          voice_note_url: voiceNoteUrl,
          voice_transcript_en: voiceTranscript,
          media_urls: mediaUrls,
          third_party_details: null,
        });

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
    if (incidentType === 'burst_geyser') return 4;
    return 3;
  };

  const getMotorAccidentStepContent = () => {
    if (step === 2) {
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
                Panel Beater Location *
              </label>
              <select
                value={panelBeaterLocation}
                onChange={(e) => setPanelBeaterLocation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a panel beater</option>
                {PANEL_BEATER_LOCATIONS.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setStep(3)}
              disabled={!accidentDateTime || !carCondition || !panelBeaterLocation}
              className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    if (step === 3) {
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

            <button
              onClick={() => setStep(4)}
              disabled={!driverLicensePhoto || !licenseDiskPhoto}
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
            Third Party Details
          </h2>
          <p className="text-gray-600 mb-6">
            Provide information about the other party involved
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Third Party Name
              </label>
              <input
                type="text"
                value={thirdPartyName}
                onChange={(e) => setThirdPartyName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Third Party Phone
              </label>
              <input
                type="tel"
                value={thirdPartyPhone}
                onChange={(e) => setThirdPartyPhone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Third Party Vehicle Details
              </label>
              <input
                type="text"
                value={thirdPartyVehicle}
                onChange={(e) => setThirdPartyVehicle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Make, model, registration"
              />
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
              className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    if (step === 5) {
      return (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Vehicle Damage Photos
          </h2>
          <p className="text-gray-600 mb-6">
            Upload 4 photos showing the damage to your vehicle
          </p>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Damage Photo 1 *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setDamagePhoto1(e.target.files?.[0] || null)}
                    className="hidden"
                    id="damage-1"
                  />
                  <label htmlFor="damage-1" className="cursor-pointer">
                    <Camera className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-600">
                      {damagePhoto1 ? damagePhoto1.name : 'Upload photo'}
                    </p>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Damage Photo 2 *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setDamagePhoto2(e.target.files?.[0] || null)}
                    className="hidden"
                    id="damage-2"
                  />
                  <label htmlFor="damage-2" className="cursor-pointer">
                    <Camera className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-600">
                      {damagePhoto2 ? damagePhoto2.name : 'Upload photo'}
                    </p>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Damage Photo 3 *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setDamagePhoto3(e.target.files?.[0] || null)}
                    className="hidden"
                    id="damage-3"
                  />
                  <label htmlFor="damage-3" className="cursor-pointer">
                    <Camera className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-600">
                      {damagePhoto3 ? damagePhoto3.name : 'Upload photo'}
                    </p>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Damage Photo 4 *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setDamagePhoto4(e.target.files?.[0] || null)}
                    className="hidden"
                    id="damage-4"
                  />
                  <label htmlFor="damage-4" className="cursor-pointer">
                    <Camera className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-600">
                      {damagePhoto4 ? damagePhoto4.name : 'Upload photo'}
                    </p>
                  </label>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(6)}
              disabled={!damagePhoto1 || !damagePhoto2 || !damagePhoto3 || !damagePhoto4}
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
            Record a detailed voice note describing what happened during the accident
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
            onClick={() => setStep(7)}
            disabled={!audioBlob}
            className="w-full mt-6 bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      );
    }

    if (step === 7) {
      return (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Review & Submit</h2>
          <p className="text-gray-600 mb-6">
            Please review your claim details before submitting
          </p>

          <div className="space-y-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Accident Date</p>
              <p className="font-semibold">
                {new Date(accidentDateTime).toLocaleString()}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Location</p>
              <p className="text-sm text-gray-700">{locationAddress || 'Not provided'}</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Car Condition</p>
              <p className="font-semibold">
                {carCondition === 'drivable' ? 'Drivable' : 'Not Drivable'}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Panel Beater</p>
              <p className="text-sm text-gray-700">{panelBeaterLocation}</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Documentation</p>
              <p className="text-sm text-gray-700">
                Driver license, License disk, 4 damage photos, Voice statement
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-yellow-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-800 mb-1">
                  Important: Police Case Number Required
                </p>
                <p className="text-sm text-yellow-700">
                  Please visit your nearest police station to file a report. A police case
                  number will be needed once this claim is registered with your broker.
                </p>
              </div>
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
      );
    }
  };

  // Handle Past Claims view
  if (viewMode === 'past-claims') {
    return (
      <ClientPastClaims
        onViewClaim={(claimId) => {
          setSelectedClaimId(claimId);
          setViewMode('claim-detail');
        }}
        onBack={() => setViewMode('home')}
      />
    );
  }

  // Handle Claim Detail view
  if (viewMode === 'claim-detail' && selectedClaimId) {
    return (
      <ClientClaimDetail
        claimId={selectedClaimId}
        onBack={() => {
          setSelectedClaimId(null);
          setViewMode('past-claims');
        }}
      />
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Claim Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Your claim has been successfully submitted. A broker will review it shortly.
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
            onClick={() => window.location.reload()}
            className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
          >
            Submit Another Claim
          </button>
        </div>
      </div>
    );
  }

  if (claimType === 'theft' && clientData) {
    return (
      <TheftClaimForm
        clientId={clientData.id}
        brokerageId={clientData.brokerage_id}
        onBack={() => setClaimType(null)}
      />
    );
  }

  if (claimType === 'motor_vehicle_theft' && clientData) {
    return (
      <MotorVehicleTheftForm
        clientId={clientData.id}
        brokerageId={clientData.brokerage_id}
        onBack={() => setClaimType(null)}
      />
    );
  }

  if (claimType === 'structural_damage' && clientData) {
    return (
      <StructuralDamageForm
        clientId={clientData.id}
        brokerageId={clientData.brokerage_id}
        onBack={() => setClaimType(null)}
      />
    );
  }

  if (claimType === 'all_risk' && clientData) {
    return (
      <AllRiskForm
        clientId={clientData.id}
        brokerageId={clientData.brokerage_id}
        onBack={() => setClaimType(null)}
      />
    );
  }

  if (!claimType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="max-w-6xl mx-auto p-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">File a Claim</h1>
              <p className="text-gray-600 mt-1">Select the type of claim you'd like to submit</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode('past-claims')}
                className="flex items-center px-4 py-2 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition font-medium"
              >
                <History className="w-5 h-5 mr-2" />
                Past Claims
              </button>
              <button
                onClick={signOut}
                className="flex items-center px-4 py-2 text-gray-700 hover:bg-white rounded-lg transition"
              >
                <LogOut className="w-5 h-5 mr-2" />
                Sign Out
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <button
              onClick={() => setViewMode('past-claims')}
              className="group bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-md hover:shadow-2xl p-8 text-left transition-all duration-300 hover:-translate-y-1 border-2 border-blue-500"
            >
              <div className="bg-white/20 rounded-xl w-16 h-16 flex items-center justify-center mb-5 group-hover:bg-white/30 transition-colors">
                <History className="w-9 h-9 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Past Claims</h3>
              <p className="text-sm text-blue-50 mb-8 leading-relaxed">
                View and update documents for your submitted claims
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-100">View your claims</span>
                <span className="text-white text-sm font-semibold group-hover:translate-x-1 transition-transform">Open →</span>
              </div>
            </button>

            <button
              onClick={() => {
                setClaimType('motor');
                setIncidentType('motor_accident');
                setStep(2);
              }}
              className="group bg-white rounded-2xl shadow-md hover:shadow-2xl p-8 text-left transition-all duration-300 hover:-translate-y-1 border border-gray-100"
            >
              <div className="bg-blue-50 rounded-xl w-16 h-16 flex items-center justify-center mb-5 group-hover:bg-blue-100 transition-colors">
                <Car className="w-9 h-9 text-blue-700" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Motor Accident</h3>
              <p className="text-sm text-gray-600 mb-8 leading-relaxed">
                Vehicle collision or road incident claim
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">5 steps • 10 min</span>
                <span className="text-blue-700 text-sm font-semibold group-hover:translate-x-1 transition-transform">Start →</span>
              </div>
            </button>

            <button
              onClick={() => {
                setClaimType('geyser');
                setIncidentType('burst_geyser');
                setStep(2);
              }}
              className="group bg-white rounded-2xl shadow-md hover:shadow-2xl p-8 text-left transition-all duration-300 hover:-translate-y-1 border border-gray-100"
            >
              <div className="bg-cyan-50 rounded-xl w-16 h-16 flex items-center justify-center mb-5 group-hover:bg-cyan-100 transition-colors">
                <Droplet className="w-9 h-9 text-cyan-700" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Burst Geyser</h3>
              <p className="text-sm text-gray-600 mb-8 leading-relaxed">
                Water heater leak or damage claim
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">4 steps • 5 min</span>
                <span className="text-cyan-700 text-sm font-semibold group-hover:translate-x-1 transition-transform">Start →</span>
              </div>
            </button>

            <button
              onClick={() => setClaimType('motor_vehicle_theft')}
              className="group bg-white rounded-2xl shadow-md hover:shadow-2xl p-8 text-left transition-all duration-300 hover:-translate-y-1 border border-orange-100"
            >
              <div className="bg-orange-50 rounded-xl w-16 h-16 flex items-center justify-center mb-5 group-hover:bg-orange-100 transition-colors">
                <CarFront className="w-9 h-9 text-orange-700" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Motor Vehicle Theft</h3>
              <p className="text-sm text-gray-600 mb-8 leading-relaxed">
                Vehicle theft or hijacking claim
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">5 steps • 15 min</span>
                <span className="text-orange-700 text-sm font-semibold group-hover:translate-x-1 transition-transform">Start →</span>
              </div>
            </button>

            <button
              onClick={() => setClaimType('theft')}
              className="group bg-white rounded-2xl shadow-md hover:shadow-2xl p-8 text-left transition-all duration-300 hover:-translate-y-1 border border-green-100"
            >
              <div className="bg-green-50 rounded-xl w-16 h-16 flex items-center justify-center mb-5 group-hover:bg-green-100 transition-colors">
                <Shield className="w-9 h-9 text-green-700" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Theft Claim</h3>
              <p className="text-sm text-gray-600 mb-8 leading-relaxed">
                Property theft or burglary claim
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">5 steps • 15 min</span>
                <span className="text-green-700 text-sm font-semibold group-hover:translate-x-1 transition-transform">Start →</span>
              </div>
            </button>

            <button
              onClick={() => setClaimType('structural_damage')}
              className="group bg-white rounded-2xl shadow-md hover:shadow-2xl p-8 text-left transition-all duration-300 hover:-translate-y-1 border border-amber-100"
            >
              <div className="bg-amber-50 rounded-xl w-16 h-16 flex items-center justify-center mb-5 group-hover:bg-amber-100 transition-colors">
                <Home className="w-9 h-9 text-amber-700" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Structural Damage</h3>
              <p className="text-sm text-gray-600 mb-8 leading-relaxed">
                Storm, water, fire, or impact damage
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">6 steps • 15 min</span>
                <span className="text-amber-700 text-sm font-semibold group-hover:translate-x-1 transition-transform">Start →</span>
              </div>
            </button>

            <button
              onClick={() => setClaimType('all_risk')}
              className="group bg-white rounded-2xl shadow-md hover:shadow-2xl p-8 text-left transition-all duration-300 hover:-translate-y-1 border border-teal-100"
            >
              <div className="bg-teal-50 rounded-xl w-16 h-16 flex items-center justify-center mb-5 group-hover:bg-teal-100 transition-colors">
                <Briefcase className="w-9 h-9 text-teal-700" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">All-Risk Items</h3>
              <p className="text-sm text-gray-600 mb-8 leading-relaxed">
                Items lost or damaged outside your home
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">5 steps • 15 min</span>
                <span className="text-teal-700 text-sm font-semibold group-hover:translate-x-1 transition-transform">Start →</span>
              </div>
            </button>
          </div>
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
          <button
            onClick={() => {
              setClaimType(null);
              setStep(1);
              setIncidentType(null);
            }}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Claim Types
          </button>
          <button
            onClick={signOut}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sign Out
          </button>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            {Array.from({ length: Math.min(totalSteps, 7) }, (_, i) => i + 1).map((s) => (
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
                {s < Math.min(totalSteps, 7) && (
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
                    setStep(2);
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
                    setStep(2);
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
              </div>
            </div>
          )}

          {incidentType === 'motor_accident' && getMotorAccidentStepContent()}

          {incidentType === 'burst_geyser' && step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Geyser Details
              </h2>
              <p className="text-gray-600 mb-6">
                Upload a video of the leak and photo of serial number
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leak Video *
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

                <button
                  onClick={() => setStep(3)}
                  disabled={!leakVideo || !serialPhoto}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {incidentType === 'burst_geyser' && step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Voice Statement
              </h2>
              <p className="text-gray-600 mb-6">
                Record a voice note describing the incident
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
                onClick={() => setStep(4)}
                disabled={!audioBlob}
                className="w-full mt-6 bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {incidentType === 'burst_geyser' && step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Review & Submit</h2>
              <p className="text-gray-600 mb-6">
                Please review your claim details before submitting
              </p>

              <div className="space-y-4 mb-6">
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
