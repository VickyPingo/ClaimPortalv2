import { FileText } from 'lucide-react';

interface DynamicDataViewerProps {
  data: any;
  title?: string;
}

export default function DynamicDataViewer({ data, title = 'Complete Claim Data' }: DynamicDataViewerProps) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const labelMap: Record<string, string> = {
    is_bonded: 'Is Property Bonded',
    bond_holder_bank: 'Bond Holder Bank',
    is_habitable: 'Is Home Habitable',
    is_property_secure: 'Is Property Secure',
    is_gradual_leak: 'Is Gradual Leak',
    water_entry_point: 'Water Entry Point',
    incident_type: 'Sub Incident Type',
    sub_incident_type: 'Sub Incident Type',
    is_glass_only: 'Glass Only Damage',
    roof_construction: 'Roof Construction',
    estimated_repair_cost: 'Estimated Repair Cost',
    location_address: 'Location Address',
    location_lat: 'Location Latitude',
    location_lng: 'Location Longitude',
    car_condition: 'Car Condition',
    panel_beater_location: 'Panel Beater Location',
    third_party_name: 'Third Party Name',
    third_party_phone: 'Third Party Phone',
    third_party_vehicle: 'Third Party Vehicle',
    accident_date_time: 'Accident Date & Time',
    selected_province: 'Selected Province',
    selected_city: 'Selected City',
    has_all_keys: 'Has All Keys',
    vehicle_make: 'Vehicle Make',
    vehicle_model: 'Vehicle Model',
    vehicle_year: 'Vehicle Year',
    vehicle_registration: 'Vehicle Registration',
    saps_case_number: 'SAPS Case Number',
    police_station_name: 'Police Station',
    voice_transcript: 'Voice Transcript',
    voice_transcript_updated_at: 'Transcript Updated At',
    media_count: 'Media Count',
  };

  const getLabel = (key: string) =>
    labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const formatKey = (key: string): string => {
    return getLabel(key);
  };

  const formatValue = (value: any): string => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    if (value === null || value === undefined || value === '') return 'N/A';
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
      return new Date(value).toLocaleString();
    }
    if (typeof value === 'number' && String(value).includes('.') === false && value > 1000) {
      return `R ${value.toLocaleString()}`;
    }
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  };

  const renderValue = (key: string, value: any, depth: number = 0): JSX.Element => {
    const indentClass = depth > 0 ? 'ml-6' : '';

    if (key === 'items' && Array.isArray(value)) {
      return (
        <div key={key} className="mb-4">
          <p className="text-sm font-semibold text-gray-600 mb-2">Claimed Items</p>
          <div className="space-y-3">
            {value.map((item: any, idx: number) => (
              <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                <p className="font-semibold text-gray-900">{item.description} ({item.category})</p>
                {item.makeModel && <p className="text-gray-600">Make/Model: {item.makeModel}</p>}
                {item.serialImei && <p className="text-gray-600">Serial/IMEI: {item.serialImei}</p>}
                <p className="text-gray-600">Replacement Value: R {Number(item.replacementValue).toLocaleString()}</p>
                <p className="text-gray-600">On Policy: {item.onPolicy === 'yes' ? 'Yes' : item.onPolicy === 'no' ? 'No' : 'Unsure'}</p>
                {item.deviceBlacklisted !== undefined && <p className="text-gray-600">Blacklisted: {item.deviceBlacklisted ? 'Yes' : 'No'}</p>}
                {item.findMyDeviceLocked !== undefined && <p className="text-gray-600">Find My Device Locked: {item.findMyDeviceLocked ? 'Yes' : 'No'}</p>}
                {item.hasValuationCert !== undefined && <p className="text-gray-600">Valuation Certificate: {item.hasValuationCert ? 'Yes' : 'No'}</p>}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={key} className={`${indentClass} mb-4`}>
          <div className="font-semibold text-gray-700 mb-2">{formatKey(key)}</div>
          <div className="space-y-2">
            {value.map((item, index) => (
              <div key={index} className="ml-4 p-3 bg-gray-50 rounded border border-gray-200">
                {typeof item === 'object' ? renderObject(item, depth + 1) : (
                  <div className="text-sm text-gray-900">{formatValue(item)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (typeof value === 'object' && value !== null) {
      return (
        <div key={key} className={`${indentClass} mb-4`}>
          <div className="font-semibold text-gray-700 mb-2">{formatKey(key)}</div>
          <div className="ml-4 p-4 bg-blue-50 rounded border-l-4 border-blue-500">
            {renderObject(value, depth + 1)}
          </div>
        </div>
      );
    }

    return (
      <div key={key} className={`${indentClass} flex py-2 border-b border-gray-100`}>
        <div className="w-1/3 font-medium text-gray-600 text-sm">{formatKey(key)}</div>
        <div className="w-2/3 text-gray-900 text-sm break-words">{formatValue(value)}</div>
      </div>
    );
  };

  const renderObject = (obj: any, depth: number = 0): JSX.Element[] => {
    return Object.entries(obj)
      .filter(([key, value]) => {
        if (key === 'selected_city' || key === 'selected_province') return false;
        if (value === null || value === undefined || value === '') return false;
        return true;
      })
      .map(([key, value]) => renderValue(key, value, depth));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-1">
        {renderObject(data)}
      </div>
    </div>
  );
}
