import { FileText } from 'lucide-react';

interface DynamicDataViewerProps {
  data: any;
  title?: string;
}

export default function DynamicDataViewer({ data, title = 'Complete Claim Data' }: DynamicDataViewerProps) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const formatKey = (key: string): string => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
      return new Date(value).toLocaleString();
    }
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  };

  const renderValue = (key: string, value: any, depth: number = 0): JSX.Element => {
    const indentClass = depth > 0 ? 'ml-6' : '';

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
    return Object.entries(obj).map(([key, value]) => renderValue(key, value, depth));
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
