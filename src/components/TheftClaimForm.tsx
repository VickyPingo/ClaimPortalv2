import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { submitClaimUnified } from '../lib/claimSubmission';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  MapPin,
  Phone,
  HelpCircle,
} from 'lucide-react';

type Step = 1 | 2 | 3 | 4 | 5 | 'success';
type ProofType = 'invoice' | 'bank_statement' | 'photo' | 'manual';

interface StolenItem {
  id: string;
  description: string;
  makeModel: string;
  serialNumber: string;
  purchaseYear: string;
  replacementValue: string;
  proofType: ProofType;
}

interface TheftClaimFormProps {
  clientId: string;
  brokerageId: string;
  onBack: () => void;
}

const USSD_CODES = {
  Vodacom: '082 111',
  MTN: '135',
  'Cell C': '140',
};

export default function TheftClaimForm({ clientId, brokerageId, onBack }: TheftClaimFormProps) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [showITCHelper, setShowITCHelper] = useState(false);

  // Step 1: Police Report
  const [sapsCase, setSapsCase] = useState('');
  const [policeStation, setPoliceStation] = useState('');
  const [dateReported, setDateReported] = useState('');
  const [investigatingOfficer, setInvestigatingOfficer] = useState('');

  // Step 2: Incident Details
  const [incidentDateTime, setIncidentDateTime] = useState('');
  const [propertyOccupied, setPropertyOccupied] = useState<boolean | null>(null);
  const [forcedEntry, setForcedEntry] = useState<boolean | null>(null);
  const [forcedEntryPhoto, setForcedEntryPhoto] = useState<File | null>(null);

  // Step 3: Stolen Items
  const [items, setItems] = useState<StolenItem[]>([]);
  const [newItem, setNewItem] = useState<StolenItem>({
    id: '',
    description: '',
    makeModel: '',
    serialNumber: '',
    purchaseYear: '',
    replacementValue: '',
    proofType: 'invoice',
  });

  // Step 4: ITC/Blacklisting
  const [cellphoneStolen, setCellphoneStolen] = useState(false);
  const [itcRefNumber, setItcRefNumber] = useState('');

  // Step 5: Documents
  const [sapsCaseSlip, setSapsCaseSlip] = useState<File | null>(null);
  const [proofOfOwnership, setProofOfOwnership] = useState<File | null>(null);
  const [replacementQuote, setReplacementQuote] = useState<File | null>(null);

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

  const uploadFile = async (file: File, bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const addItem = () => {
    if (
      !newItem.description.trim() ||
      !newItem.replacementValue ||
      !newItem.proofType
    ) {
      alert('Please fill in item description, replacement value, and proof type');
      return;
    }

    const item = { ...newItem, id: Date.now().toString() };
    setItems([...items, item]);
    setNewItem({
      id: '',
      description: '',
      makeModel: '',
      serialNumber: '',
      purchaseYear: '',
      replacementValue: '',
      proofType: 'invoice',
    });

    if (newItem.description.toLowerCase().includes('phone')) {
      setCellphoneStolen(true);
    }
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const totalClaimValue = items.reduce((sum, item) => sum + (parseFloat(item.replacementValue) || 0), 0);

  const validateStep1 = () => {
    if (!sapsCase.trim() || !policeStation.trim() || !dateReported) {
      alert('Please fill in all required fields');
      return false;
    }
    const casRegex = /^CAS\s\d+\/\d+\/\d{4}$/i;
    if (!casRegex.test(sapsCase)) {
      alert('SAPS Case Number format should be: CAS 123/01/2024');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!incidentDateTime || propertyOccupied === null || forcedEntry === null) {
      alert('Please fill in all required fields');
      return false;
    }
    if (forcedEntry && !forcedEntryPhoto) {
      alert('Please upload a photo of forced entry');
      return false;
    }
    return true;
  };

  const validateStep5 = () => {
    if (!sapsCaseSlip || !proofOfOwnership) {
      alert('Please upload SAPS case slip and proof of ownership');
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

      // Helper to get file extension
      const getFileExt = (file: File) => {
        const name = file.name;
        const lastDot = name.lastIndexOf('.');
        return lastDot > 0 ? name.substring(lastDot) : '.jpg';
      };

      const sapsCaseSlipExt = getFileExt(sapsCaseSlip);
      const proofOfOwnershipExt = getFileExt(proofOfOwnership);

      const sapsCaseSlipUrl = await uploadFile(sapsCaseSlip, 'claims', `${uploadDir}/saps_case_slip${sapsCaseSlipExt}`);
      const proofOfOwnershipUrl = await uploadFile(proofOfOwnership, 'claims', `${uploadDir}/proof_of_ownership${proofOfOwnershipExt}`);

      let replacementQuoteUrl = null;
      let replacementQuoteExt = '';
      if (replacementQuote) {
        replacementQuoteExt = getFileExt(replacementQuote);
        replacementQuoteUrl = await uploadFile(replacementQuote, 'claims', `${uploadDir}/replacement_quote${replacementQuoteExt}`);
      }

      let forcedEntryPhotoUrl = null;
      let forcedEntryPhotoExt = '';
      if (forcedEntryPhoto) {
        forcedEntryPhotoExt = getFileExt(forcedEntryPhoto);
        forcedEntryPhotoUrl = await uploadFile(forcedEntryPhoto, 'claims', `${uploadDir}/forced_entry_photo${forcedEntryPhotoExt}`);
      }

      // Build attachments array
      const attachments: Array<{ bucket: string; path: string; url: string; kind?: string; label?: string }> = [];

      attachments.push({ bucket: 'claims', path: `${uploadDir}/saps_case_slip${sapsCaseSlipExt}`, url: sapsCaseSlipUrl, kind: 'saps_case_slip', label: 'SAPS Case Slip' });
      attachments.push({ bucket: 'claims', path: `${uploadDir}/proof_of_ownership${proofOfOwnershipExt}`, url: proofOfOwnershipUrl, kind: 'proof_of_ownership', label: 'Proof of Ownership' });

      if (replacementQuoteUrl) {
        attachments.push({ bucket: 'claims', path: `${uploadDir}/replacement_quote${replacementQuoteExt}`, url: replacementQuoteUrl, kind: 'replacement_quote', label: 'Replacement Quote' });
      }

      if (forcedEntryPhotoUrl) {
        attachments.push({ bucket: 'claims', path: `${uploadDir}/forced_entry_photo${forcedEntryPhotoExt}`, url: forcedEntryPhotoUrl, kind: 'forced_entry_photo', label: 'Forced Entry Photo' });
      }

      const claimData = {
        saps_case_number: sapsCase,
        police_station_name: policeStation,
        date_reported: new Date(dateReported).toISOString(),
        investigating_officer_name: investigatingOfficer || null,
        incident_date_time: new Date(incidentDateTime).toISOString(),
        property_occupied: propertyOccupied,
        forced_entry: forcedEntry,
        incident_location_address: locationAddress,
        incident_lat: location?.lat || null,
        incident_lng: location?.lng || null,
        cellphone_stolen: cellphoneStolen,
        itc_reference_number: cellphoneStolen ? itcRefNumber : null,
        total_claim_value: totalClaimValue,
        stolen_items: items,
      };

      await submitClaimUnified({
        claimType: 'theft',
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Theft Claim Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Your claim has been successfully submitted with a total claim value of R{totalClaimValue.toLocaleString()}.
            A broker will review it shortly.
          </p>
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
          <div className="flex items-center justify-between">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
              <div key={s} className="flex-1 flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    currentStepNum >= s ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s}
                </div>
                {s < totalSteps && (
                  <div
                    className={`flex-1 h-1 mx-1 ${currentStepNum > s ? 'bg-blue-700' : 'bg-gray-200'}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">The Police Report</h2>
              <p className="text-gray-600 mb-6">
                A police report is mandatory. You cannot proceed without a SAPS case number.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SAPS Case Number *
                    <span className="ml-1 text-gray-500 cursor-help group relative">
                      <HelpCircle className="w-4 h-4 inline" />
                      <div className="hidden group-hover:block absolute bottom-full left-0 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                        Format: CAS 123/01/2024
                      </div>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={sapsCase}
                    onChange={(e) => setSapsCase(e.target.value.toUpperCase())}
                    placeholder="CAS 123/01/2024"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This is the CAS number found on the SMS or slip from the police station.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Police Station Name *
                  </label>
                  <input
                    type="text"
                    value={policeStation}
                    onChange={(e) => setPoliceStation(e.target.value)}
                    placeholder="e.g., Johannesburg Central Police Station"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Reported *
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
                    Investigating Officer Name
                  </label>
                  <input
                    type="text"
                    value={investigatingOfficer}
                    onChange={(e) => setInvestigatingOfficer(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Incident Details</h2>
              <p className="text-gray-600 mb-6">
                Tell us about the theft incident and location.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date & Time of Theft *
                  </label>
                  <input
                    type="datetime-local"
                    value={incidentDateTime}
                    onChange={(e) => setIncidentDateTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {location && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Incident Location
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Was the property occupied at the time? *
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setPropertyOccupied(true)}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                        propertyOccupied === true
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">Yes</p>
                      <p className="text-sm text-gray-600">Property was occupied</p>
                    </button>
                    <button
                      onClick={() => setPropertyOccupied(false)}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                        propertyOccupied === false
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">No</p>
                      <p className="text-sm text-gray-600">Property was unoccupied</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Are there visible signs of forced entry? *
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setForcedEntry(true)}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                        forcedEntry === true
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">Yes</p>
                      <p className="text-sm text-gray-600">Damaged door/window visible</p>
                    </button>
                    <button
                      onClick={() => setForcedEntry(false)}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                        forcedEntry === false
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">No</p>
                      <p className="text-sm text-gray-600">No visible forced entry signs</p>
                    </button>
                  </div>
                </div>

                {forcedEntry === true && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Photo of Forced Entry *
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setForcedEntryPhoto(e.target.files?.[0] || null)}
                        className="hidden"
                        id="forced-entry-photo"
                      />
                      <label htmlFor="forced-entry-photo" className="cursor-pointer">
                        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          {forcedEntryPhoto ? forcedEntryPhoto.name : 'Upload photo of damaged door/window'}
                        </p>
                      </label>
                    </div>
                  </div>
                )}

                {forcedEntry === false && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-800">
                          Important Note
                        </p>
                        <p className="text-sm text-yellow-700 mt-1">
                          Unforced theft claims may carry a different excess. Ensure all proof of theft is documented.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Stolen Items Register</h2>
              <p className="text-gray-600 mb-6">
                Add each stolen item. Total Claim Value: <span className="font-bold">R{totalClaimValue.toLocaleString()}</span>
              </p>

              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-gray-900">Add New Item</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Item Description *
                    </label>
                    <input
                      type="text"
                      value={newItem.description}
                      onChange={(e) =>
                        setNewItem({ ...newItem, description: e.target.value })
                      }
                      placeholder="e.g., MacBook Pro 16-inch"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Make/Model
                      </label>
                      <input
                        type="text"
                        value={newItem.makeModel}
                        onChange={(e) =>
                          setNewItem({ ...newItem, makeModel: e.target.value })
                        }
                        placeholder="e.g., Apple"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Serial Number
                      </label>
                      <input
                        type="text"
                        value={newItem.serialNumber}
                        onChange={(e) =>
                          setNewItem({ ...newItem, serialNumber: e.target.value })
                        }
                        placeholder="Optional"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Purchase Year
                      </label>
                      <input
                        type="number"
                        value={newItem.purchaseYear}
                        onChange={(e) =>
                          setNewItem({ ...newItem, purchaseYear: e.target.value })
                        }
                        placeholder="e.g., 2023"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Replacement Value (R) *
                      </label>
                      <input
                        type="number"
                        value={newItem.replacementValue}
                        onChange={(e) =>
                          setNewItem({
                            ...newItem,
                            replacementValue: e.target.value,
                          })
                        }
                        placeholder="0.00"
                        step="0.01"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Proof Type *
                    </label>
                    <select
                      value={newItem.proofType}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          proofType: e.target.value as ProofType,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="invoice">Invoice/Receipt (Best)</option>
                      <option value="bank_statement">Bank Statement Transaction</option>
                      <option value="photo">Photo of Item</option>
                      <option value="manual">Manual/Warranty Card</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Select what proof you have of ownership.
                    </p>
                  </div>

                  <button
                    onClick={addItem}
                    className="w-full bg-blue-700 text-white py-2 rounded-lg font-medium hover:bg-blue-800 flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Item
                  </button>
                </div>

                {items.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">
                              Description
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">
                              Value (R)
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">
                              Proof
                            </th>
                            <th className="px-4 py-3 text-center font-semibold text-gray-700">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-3 text-gray-900">
                                <p className="font-medium">{item.description}</p>
                                {item.makeModel && (
                                  <p className="text-xs text-gray-500">{item.makeModel}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-900 font-medium">
                                R{parseFloat(item.replacementValue).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs">
                                {item.proofType.replace('_', ' ')}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => removeItem(item.id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 font-semibold text-gray-900 text-right">
                      Total: R{totalClaimValue.toLocaleString()}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => items.length > 0 && setStep(4)}
                  disabled={items.length === 0}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">ITC / Blacklisting</h2>
              <p className="text-gray-600 mb-6">
                If a cellphone was stolen, you must blacklist it to claim.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Was a Cellphone stolen?
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setCellphoneStolen(true)}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                        cellphoneStolen
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">Yes</p>
                      <p className="text-sm text-gray-600">A cellphone was stolen</p>
                    </button>
                    <button
                      onClick={() => setCellphoneStolen(false)}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                        !cellphoneStolen
                          ? 'border-blue-700 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">No</p>
                      <p className="text-sm text-gray-600">No cellphone stolen</p>
                    </button>
                  </div>
                </div>

                {cellphoneStolen && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ITC Reference Number
                      </label>
                      <input
                        type="text"
                        value={itcRefNumber}
                        onChange={(e) => setItcRefNumber(e.target.value)}
                        placeholder="e.g., ITC123456789"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This is provided when you blacklist the phone with your network.
                      </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <button
                        onClick={() => setShowITCHelper(!showITCHelper)}
                        className="flex items-center text-blue-700 font-medium hover:text-blue-800 w-full"
                      >
                        <Phone className="w-5 h-5 mr-2" />
                        How to Blacklist Your Phone?
                      </button>

                      {showITCHelper && (
                        <div className="mt-4 space-y-3 pt-4 border-t border-blue-200">
                          {Object.entries(USSD_CODES).map(([carrier, code]) => (
                            <div key={carrier} className="flex items-start">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{carrier}</p>
                                <p className="text-sm text-gray-600">Dial: <span className="font-mono font-bold">*{code}#</span></p>
                              </div>
                            </div>
                          ))}
                          <p className="text-xs text-gray-600 pt-2 border-t border-blue-200">
                            Call the USSD code above on your network to blacklist the stolen device.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <button
                  onClick={() => setStep(5)}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Supporting Documents</h2>
              <p className="text-gray-600 mb-6">
                Upload all required documents to complete your claim.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SAPS Case Slip / Report *
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
                      <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {sapsCaseSlip ? sapsCaseSlip.name : 'Upload SAPS case slip or report'}
                      </p>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Proof of Ownership *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setProofOfOwnership(e.target.files?.[0] || null)}
                      className="hidden"
                      id="proof-ownership"
                    />
                    <label htmlFor="proof-ownership" className="cursor-pointer">
                      <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {proofOfOwnership
                          ? proofOfOwnership.name
                          : 'Upload invoice, receipt, or box photo'}
                      </p>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Invoice, receipt, bank statement, or photo of item.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quote for Replacement
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setReplacementQuote(e.target.files?.[0] || null)}
                      className="hidden"
                      id="replacement-quote"
                    />
                    <label htmlFor="replacement-quote" className="cursor-pointer">
                      <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {replacementQuote
                          ? replacementQuote.name
                          : 'Upload PDF or image (optional)'}
                      </p>
                    </label>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">Claim Summary:</span>
                    <br />
                    Total items: {items.length}
                    <br />
                    Total claim value: R{totalClaimValue.toLocaleString()}
                    {cellphoneStolen && <br />}
                    {cellphoneStolen && `ITC Reference: ${itcRefNumber || 'Not provided'}`}
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
                    'Submit Theft Claim'
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
