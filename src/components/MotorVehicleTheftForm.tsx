import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { submitClaimUnified } from '../lib/claimSubmission';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  MapPin,
  Camera,
  Shield,
  AlertTriangle,
  Heart,
  Key,
  FileText,
} from 'lucide-react';

type Step = 1 | 2 | 3 | 4 | 5 | 'success';
type IncidentType = 'theft' | 'hijacking' | null;

interface MotorVehicleTheftFormProps {
  clientId: string;
  brokerageId: string;
  onBack: () => void;
}

const BANKS = [
  'Wesbank',
  'Absa Vehicle Finance',
  'MFC (Nedbank)',
  'Standard Bank',
  'FNB Vehicle Finance',
  'Other',
];

const HIGH_VALUE_KEYWORDS = ['suv', '4x4', 'fortuner', 'ranger', 'hilux', 'land cruiser', 'patrol'];

export default function MotorVehicleTheftForm({
  clientId,
  brokerageId,
  onBack,
}: MotorVehicleTheftFormProps) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState('');

  const [incidentType, setIncidentType] = useState<IncidentType>(null);
  const [traumaCounselingRequested, setTraumaCounselingRequested] = useState(false);
  const [hasAllKeys, setHasAllKeys] = useState<boolean | null>(null);
  const [missingKeysExplanation, setMissingKeysExplanation] = useState('');

  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleRegistration, setVehicleRegistration] = useState('');
  const [vehicleVin, setVehicleVin] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');

  const [isFinanced, setIsFinanced] = useState<boolean | null>(null);
  const [financeBank, setFinanceBank] = useState('');
  const [financeAccountNumber, setFinanceAccountNumber] = useState('');

  const [hasTrackingDevice, setHasTrackingDevice] = useState<boolean | null>(null);
  const [reportedToTracker, setReportedToTracker] = useState<boolean | null>(null);
  const [trackerCompanyName, setTrackerCompanyName] = useState('');

  const [lastDriverName, setLastDriverName] = useState('');
  const [lastDriverIdNumber, setLastDriverIdNumber] = useState('');
  const [lastDriverLicenseCode, setLastDriverLicenseCode] = useState('');

  const [driverLicenseFront, setDriverLicenseFront] = useState<File | null>(null);
  const [driverLicenseBack, setDriverLicenseBack] = useState<File | null>(null);
  const [sapsCaseSlip, setSapsCaseSlip] = useState<File | null>(null);
  const [proofOfPurchase, setProofOfPurchase] = useState<File | null>(null);

  const [sapsCaseNumber, setSapsCaseNumber] = useState('');
  const [policeStationName, setPoliceStationName] = useState('');
  const [dateReported, setDateReported] = useState('');
  const [incidentDateTime, setIncidentDateTime] = useState('');

  const [showKeyWarning, setShowKeyWarning] = useState(false);
  const [showTrackerWarning, setShowTrackerWarning] = useState(false);
  const [showSettlementHelper, setShowSettlementHelper] = useState(false);

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

  useEffect(() => {
    if (incidentType === 'theft' && hasAllKeys === false) {
      setShowKeyWarning(true);
    } else {
      setShowKeyWarning(false);
    }
  }, [incidentType, hasAllKeys]);

  useEffect(() => {
    const vehicleInfo = `${vehicleMake} ${vehicleModel}`.toLowerCase();
    const isHighValue = HIGH_VALUE_KEYWORDS.some((keyword) =>
      vehicleInfo.includes(keyword)
    );
    if (isHighValue && hasTrackingDevice === false) {
      setShowTrackerWarning(true);
    } else {
      setShowTrackerWarning(false);
    }
  }, [vehicleMake, vehicleModel, hasTrackingDevice]);

  useEffect(() => {
    if (isFinanced === true) {
      setShowSettlementHelper(true);
    } else {
      setShowSettlementHelper(false);
    }
  }, [isFinanced]);

  const uploadFile = async (file: File, bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const validateStep1 = () => {
    if (!incidentType) {
      alert('Please select incident type');
      return false;
    }
    if (incidentType === 'theft' && hasAllKeys === null) {
      alert('Please answer if you have all keys');
      return false;
    }
    if (incidentType === 'theft' && hasAllKeys === false && !missingKeysExplanation.trim()) {
      alert('Please explain the whereabouts of missing keys');
      return false;
    }
    if (!sapsCaseNumber.trim() || !policeStationName.trim() || !dateReported || !incidentDateTime) {
      alert('Please fill in all police report fields');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (
      !vehicleMake.trim() ||
      !vehicleModel.trim() ||
      !vehicleYear ||
      !vehicleRegistration.trim() ||
      !vehicleColor.trim()
    ) {
      alert('Please fill in all required vehicle details');
      return false;
    }
    if (isFinanced === null) {
      alert('Please indicate if the vehicle is financed');
      return false;
    }
    if (isFinanced && (!financeBank || !financeAccountNumber.trim())) {
      alert('Please provide finance details');
      return false;
    }
    if (hasTrackingDevice === null) {
      alert('Please indicate if the vehicle has a tracking device');
      return false;
    }
    if (hasTrackingDevice && reportedToTracker === null) {
      alert('Please indicate if you reported to the tracker company');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (
      !lastDriverName.trim() ||
      !lastDriverIdNumber.trim() ||
      !lastDriverLicenseCode.trim()
    ) {
      alert('Please fill in all driver information fields');
      return false;
    }
    return true;
  };

  const validateStep4 = () => {
    if (!driverLicenseFront || !driverLicenseBack || !sapsCaseSlip) {
      alert('Please upload driver license (front and back) and SAPS case slip');
      return false;
    }
    return true;
  };

  const validateStep5 = () => {
    if (!location || !locationAddress.trim()) {
      alert('Please provide the last known location');
      return false;
    }
    return true;
  };

  const submitClaim = async () => {
    if (!validateStep5()) return;

    setLoading(true);
    try {
      const timestamp = Date.now();
      const uploadDir = `${clientId}/${timestamp}`;

      const driverLicenseFrontUrl = await uploadFile(
        driverLicenseFront!,
        'claims',
        `${uploadDir}/driver_license_front`
      );
      const driverLicenseBackUrl = await uploadFile(
        driverLicenseBack!,
        'claims',
        `${uploadDir}/driver_license_back`
      );
      const sapsCaseSlipUrl = await uploadFile(
        sapsCaseSlip!,
        'claims',
        `${uploadDir}/saps_case_slip`
      );

      let proofOfPurchaseUrl = null;
      if (proofOfPurchase) {
        proofOfPurchaseUrl = await uploadFile(
          proofOfPurchase,
          'claims',
          `${uploadDir}/proof_of_purchase`
        );
      }

      // Build attachments array
      const attachments: Array<{ bucket: string; path: string; url: string; kind?: string; label?: string }> = [];

      attachments.push({ bucket: 'claims', path: `${uploadDir}/driver_license_front`, url: driverLicenseFrontUrl, kind: 'driver_license_front', label: 'Driver License (Front)' });
      attachments.push({ bucket: 'claims', path: `${uploadDir}/driver_license_back`, url: driverLicenseBackUrl, kind: 'driver_license_back', label: 'Driver License (Back)' });
      attachments.push({ bucket: 'claims', path: `${uploadDir}/saps_case_slip`, url: sapsCaseSlipUrl, kind: 'saps_case_slip', label: 'SAPS Case Slip' });

      if (proofOfPurchaseUrl) {
        attachments.push({ bucket: 'claims', path: `${uploadDir}/proof_of_purchase`, url: proofOfPurchaseUrl, kind: 'proof_of_purchase', label: 'Proof of Purchase' });
      }

      const claimData = {
        incident_type: incidentType,
        trauma_counseling_requested: traumaCounselingRequested,
        has_all_keys: incidentType === 'theft' ? hasAllKeys : null,
        missing_keys_explanation:
          incidentType === 'theft' && hasAllKeys === false
            ? missingKeysExplanation
            : null,
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_year: parseInt(vehicleYear),
        vehicle_registration: vehicleRegistration,
        vehicle_vin: vehicleVin || null,
        vehicle_color: vehicleColor,
        is_financed: isFinanced,
        finance_bank: isFinanced ? financeBank : null,
        finance_account_number: isFinanced ? financeAccountNumber : null,
        has_tracking_device: hasTrackingDevice,
        reported_to_tracker: hasTrackingDevice ? reportedToTracker : null,
        tracker_company_name:
          hasTrackingDevice && trackerCompanyName ? trackerCompanyName : null,
        last_driver_name: lastDriverName,
        last_driver_id_number: lastDriverIdNumber,
        last_driver_license_code: lastDriverLicenseCode,
        last_known_location_lat: location?.lat || null,
        last_known_location_lng: location?.lng || null,
        last_known_location_address: locationAddress,
        saps_case_number: sapsCaseNumber,
        police_station_name: policeStationName,
        date_reported: new Date(dateReported).toISOString(),
        incident_date_time: new Date(incidentDateTime).toISOString(),
      };

      await submitClaimUnified({
        claimType: 'vehicle_theft',
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Motor Vehicle Theft Claim Submitted!
          </h2>
          <p className="text-gray-600 mb-6">
            Your claim has been successfully submitted. A broker will review it shortly.
          </p>
          {incidentType === 'hijacking' && traumaCounselingRequested && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-start">
                <Heart className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    Trauma Counseling Requested
                  </p>
                  <p className="text-sm text-blue-800 mt-1">
                    Your broker will contact you about trauma counseling services.
                  </p>
                </div>
              </div>
            </div>
          )}
          {showSettlementHelper && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-start">
                <FileText className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-900">
                    Settlement Permission Required
                  </p>
                  <p className="text-sm text-yellow-800 mt-1">
                    Your broker will send a permission to settle letter to {financeBank} for
                    settlement authorisation.
                  </p>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={onBack}
            className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
          >
            Back to Portal
          </button>
        </div>
      </div>
    );
  }

  const totalSteps = 5;
  const currentStepNum = typeof step === 'number' ? step : totalSteps;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="max-w-3xl mx-auto p-4 py-8">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-8"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Claims
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
            <Shield className="w-6 h-6 mr-2 text-blue-700" />
            Motor Vehicle Theft Claim
          </h1>
          <div className="flex items-center justify-between mt-6">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
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
                {s < totalSteps && (
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

        <div className="bg-white rounded-xl shadow-lg p-8">
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">The Incident</h2>
              <p className="text-gray-600 mb-6">
                Tell us about the incident and when it was reported
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Was this a Theft or Hijacking? *
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setIncidentType('theft')}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                        incidentType === 'theft'
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">Theft (Parked Vehicle)</p>
                      <p className="text-sm text-gray-600">
                        Vehicle was stolen while parked/unattended
                      </p>
                    </button>
                    <button
                      onClick={() => setIncidentType('hijacking')}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                        incidentType === 'hijacking'
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">Hijacking</p>
                      <p className="text-sm text-gray-600">
                        Vehicle taken with violence or threat
                      </p>
                    </button>
                  </div>
                </div>

                {incidentType === 'hijacking' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <Heart className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-red-900 mb-2">
                          We hope you are safe
                        </p>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={traumaCounselingRequested}
                            onChange={(e) => setTraumaCounselingRequested(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                          />
                          <span className="text-sm text-red-800">
                            I would like information about trauma counseling services
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {incidentType === 'theft' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Do you still have all sets of keys/remotes? *
                      </label>
                      <div className="space-y-2">
                        <button
                          onClick={() => setHasAllKeys(true)}
                          className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                            hasAllKeys === true
                              ? 'border-blue-700 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <p className="font-semibold text-gray-900">Yes</p>
                          <p className="text-sm text-gray-600">I have all keys and remotes</p>
                        </button>
                        <button
                          onClick={() => setHasAllKeys(false)}
                          className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                            hasAllKeys === false
                              ? 'border-blue-700 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <p className="font-semibold text-gray-900">No</p>
                          <p className="text-sm text-gray-600">
                            One or more keys/remotes are missing
                          </p>
                        </button>
                      </div>
                    </div>

                    {hasAllKeys === false && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Explain whereabouts of the missing keys *
                          </label>
                          <textarea
                            value={missingKeysExplanation}
                            onChange={(e) => setMissingKeysExplanation(e.target.value)}
                            rows={3}
                            placeholder="E.g., spare key was in the vehicle, given to valet, lost previously, etc."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {showKeyWarning && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div className="flex items-start">
                              <Key className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-yellow-900">
                                  Key Requirement Warning
                                </p>
                                <p className="text-sm text-yellow-800 mt-1">
                                  Please note: You may be required to provide a police
                                  affidavit explaining the missing keys. Your broker will
                                  advise on this requirement.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Police Report Details</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SAPS Case Number *
                      </label>
                      <input
                        type="text"
                        value={sapsCaseNumber}
                        onChange={(e) => setSapsCaseNumber(e.target.value.toUpperCase())}
                        placeholder="CAS 123/01/2024"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Police Station Name *
                      </label>
                      <input
                        type="text"
                        value={policeStationName}
                        onChange={(e) => setPoliceStationName(e.target.value)}
                        placeholder="e.g., Johannesburg Central Police Station"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date Reported to Police *
                      </label>
                      <input
                        type="date"
                        value={dateReported}
                        onChange={(e) => setDateReported(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
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
                  </div>
                </div>

                <button
                  onClick={() => validateStep1() && setStep(2)}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Vehicle & Finance Details
              </h2>
              <p className="text-gray-600 mb-6">
                Provide details about the stolen vehicle
              </p>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Make *
                    </label>
                    <input
                      type="text"
                      value={vehicleMake}
                      onChange={(e) => setVehicleMake(e.target.value)}
                      placeholder="e.g., Toyota"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Model *
                    </label>
                    <input
                      type="text"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      placeholder="e.g., Fortuner"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Year *
                    </label>
                    <input
                      type="number"
                      value={vehicleYear}
                      onChange={(e) => setVehicleYear(e.target.value)}
                      placeholder="e.g., 2023"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Color *
                    </label>
                    <input
                      type="text"
                      value={vehicleColor}
                      onChange={(e) => setVehicleColor(e.target.value)}
                      placeholder="e.g., White"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Registration Number *
                  </label>
                  <input
                    type="text"
                    value={vehicleRegistration}
                    onChange={(e) =>
                      setVehicleRegistration(e.target.value.toUpperCase())
                    }
                    placeholder="e.g., ABC123GP"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    VIN (Vehicle Identification Number)
                  </label>
                  <input
                    type="text"
                    value={vehicleVin}
                    onChange={(e) => setVehicleVin(e.target.value.toUpperCase())}
                    placeholder="Optional - 17 characters"
                    maxLength={17}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Found on vehicle registration documents
                  </p>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Finance Details</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Is the vehicle financed? *
                      </label>
                      <div className="space-y-2">
                        <button
                          onClick={() => setIsFinanced(true)}
                          className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                            isFinanced === true
                              ? 'border-blue-700 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <p className="font-semibold text-gray-900">Yes</p>
                          <p className="text-sm text-gray-600">Vehicle has outstanding finance</p>
                        </button>
                        <button
                          onClick={() => setIsFinanced(false)}
                          className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                            isFinanced === false
                              ? 'border-blue-700 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <p className="font-semibold text-gray-900">No</p>
                          <p className="text-sm text-gray-600">Vehicle is paid off</p>
                        </button>
                      </div>
                    </div>

                    {isFinanced && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Finance Bank *
                          </label>
                          <select
                            value={financeBank}
                            onChange={(e) => setFinanceBank(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select Bank</option>
                            {BANKS.map((bank) => (
                              <option key={bank} value={bank}>
                                {bank}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Finance Account Number *
                          </label>
                          <input
                            type="text"
                            value={financeAccountNumber}
                            onChange={(e) => setFinanceAccountNumber(e.target.value)}
                            placeholder="Account or agreement number"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {showSettlementHelper && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start">
                              <FileText className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-blue-900">
                                  Settlement Permission Required
                                </p>
                                <p className="text-sm text-blue-800 mt-1">
                                  Since your vehicle is financed, the bank (Title Holder) will
                                  be paid first. Your broker will automatically generate a
                                  permission to settle letter to send to {financeBank}.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Tracking Device</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Is a tracking device installed? *
                      </label>
                      <div className="space-y-2">
                        <button
                          onClick={() => setHasTrackingDevice(true)}
                          className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                            hasTrackingDevice === true
                              ? 'border-blue-700 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <p className="font-semibold text-gray-900">Yes</p>
                          <p className="text-sm text-gray-600">Vehicle has a tracking device</p>
                        </button>
                        <button
                          onClick={() => setHasTrackingDevice(false)}
                          className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                            hasTrackingDevice === false
                              ? 'border-blue-700 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <p className="font-semibold text-gray-900">No</p>
                          <p className="text-sm text-gray-600">No tracking device installed</p>
                        </button>
                      </div>
                    </div>

                    {hasTrackingDevice && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tracker Company Name
                          </label>
                          <input
                            type="text"
                            value={trackerCompanyName}
                            onChange={(e) => setTrackerCompanyName(e.target.value)}
                            placeholder="e.g., Tracker, Netstar, Ctrack"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Did you report the theft to the tracker company? *
                          </label>
                          <div className="space-y-2">
                            <button
                              onClick={() => setReportedToTracker(true)}
                              className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                                reportedToTracker === true
                                  ? 'border-blue-700 bg-blue-50'
                                  : 'border-gray-200 hover:border-blue-300'
                              }`}
                            >
                              <p className="font-semibold text-gray-900">Yes</p>
                              <p className="text-sm text-gray-600">Already reported to tracker</p>
                            </button>
                            <button
                              onClick={() => setReportedToTracker(false)}
                              className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                                reportedToTracker === false
                                  ? 'border-blue-700 bg-blue-50'
                                  : 'border-gray-200 hover:border-blue-300'
                              }`}
                            >
                              <p className="font-semibold text-gray-900">No</p>
                              <p className="text-sm text-gray-600">Not yet reported</p>
                            </button>
                          </div>
                        </div>

                        {reportedToTracker === false && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start">
                              <AlertTriangle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-red-900">
                                  Urgent Action Required
                                </p>
                                <p className="text-sm text-red-800 mt-1">
                                  Please contact your tracker company immediately to activate
                                  vehicle recovery. This significantly improves the chances of
                                  recovering your vehicle.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {showTrackerWarning && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-yellow-900">
                              Tracker Warranty Check
                            </p>
                            <p className="text-sm text-yellow-800 mt-1">
                              Check your policy schedule. If your policy requires a tracker for
                              this type of vehicle, this claim may be affected. Please consult
                              with your broker.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => validateStep2() && setStep(3)}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Driver Information</h2>
              <p className="text-gray-600 mb-6">
                Provide details about the last regular driver of the vehicle
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Driver Full Name *
                  </label>
                  <input
                    type="text"
                    value={lastDriverName}
                    onChange={(e) => setLastDriverName(e.target.value)}
                    placeholder="Full name as on license"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID Number *
                  </label>
                  <input
                    type="text"
                    value={lastDriverIdNumber}
                    onChange={(e) => setLastDriverIdNumber(e.target.value)}
                    placeholder="13-digit ID number"
                    maxLength={13}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    License Code *
                  </label>
                  <input
                    type="text"
                    value={lastDriverLicenseCode}
                    onChange={(e) =>
                      setLastDriverLicenseCode(e.target.value.toUpperCase())
                    }
                    placeholder="e.g., C1, EB"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    License code is found on the driver's license (e.g., C1, EB, B)
                  </p>
                </div>

                <button
                  onClick={() => validateStep3() && setStep(4)}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Documents
              </h2>
              <p className="text-gray-600 mb-6">
                Upload all required documents for your claim
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Driver's License (Front) *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setDriverLicenseFront(e.target.files?.[0] || null)}
                      className="hidden"
                      id="license-front"
                    />
                    <label htmlFor="license-front" className="cursor-pointer">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {driverLicenseFront
                          ? driverLicenseFront.name
                          : 'Upload front of driver license'}
                      </p>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Driver's License (Back) *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setDriverLicenseBack(e.target.files?.[0] || null)}
                      className="hidden"
                      id="license-back"
                    />
                    <label htmlFor="license-back" className="cursor-pointer">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {driverLicenseBack
                          ? driverLicenseBack.name
                          : 'Upload back of driver license'}
                      </p>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SAPS Case Slip *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setSapsCaseSlip(e.target.files?.[0] || null)}
                      className="hidden"
                      id="saps-slip"
                    />
                    <label htmlFor="saps-slip" className="cursor-pointer">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {sapsCaseSlip ? sapsCaseSlip.name : 'Upload SAPS case slip'}
                      </p>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Proof of Purchase / Finance Settlement Letter
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setProofOfPurchase(e.target.files?.[0] || null)}
                      className="hidden"
                      id="proof-purchase"
                    />
                    <label htmlFor="proof-purchase" className="cursor-pointer">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {proofOfPurchase
                          ? proofOfPurchase.name
                          : 'Optional but recommended'}
                      </p>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Invoice, registration papers, or finance settlement letter
                  </p>
                </div>

                <button
                  onClick={() => validateStep4() && setStep(5)}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Last Known Location</h2>
              <p className="text-gray-600 mb-6">
                Where was the vehicle parked or taken from?
              </p>

              <div className="space-y-6">
                {location && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location *
                    </label>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start mb-2">
                        <MapPin className="w-5 h-5 text-gray-600 mr-2 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-700">
                            {locationAddress || 'Fetching address...'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                          </p>
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
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">Claim Summary:</span>
                    <br />
                    Incident: {incidentType === 'theft' ? 'Theft' : 'Hijacking'}
                    <br />
                    Vehicle: {vehicleMake} {vehicleModel} ({vehicleYear})
                    <br />
                    Registration: {vehicleRegistration}
                    <br />
                    {isFinanced && `Financed by: ${financeBank}`}
                    {hasTrackingDevice && (
                      <>
                        <br />
                        Tracking: Yes
                        {reportedToTracker !== null &&
                          ` (${reportedToTracker ? 'Reported' : 'Not yet reported'})`}
                      </>
                    )}
                  </p>
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
                    'Submit Motor Vehicle Theft Claim'
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
