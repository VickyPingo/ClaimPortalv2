import { useEffect, useMemo, useRef } from 'react';
import { Camera, X, Plus } from 'lucide-react';

interface ImageUploadFieldProps {
  label: string;
  files: File[];
  onChange: (files: File[]) => void;
  minRequired?: number;
  helperText?: string;
  /** Tailwind color name used for the accent (border/text on hover, "Add" tile). Defaults to 'blue'. */
  accent?: 'blue' | 'green' | 'orange' | 'cyan';
  id: string;
}

const ACCENT_CLASSES: Record<string, { border: string; text: string; bg: string }> = {
  blue: { border: 'hover:border-blue-500', text: 'text-blue-700', bg: 'hover:bg-blue-50' },
  green: { border: 'hover:border-green-600', text: 'text-green-700', bg: 'hover:bg-green-50' },
  orange: { border: 'hover:border-orange-500', text: 'text-orange-700', bg: 'hover:bg-orange-50' },
  cyan: { border: 'hover:border-cyan-500', text: 'text-cyan-700', bg: 'hover:bg-cyan-50' },
};

export default function ImageUploadField({
  label,
  files,
  onChange,
  minRequired = 0,
  helperText,
  accent = 'blue',
  id,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const colors = ACCENT_CLASSES[accent];

  // Build (and clean up) object URLs for thumbnail previews.
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files]
  );
  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length > 0) {
      onChange([...files, ...newFiles]);
    }
    // reset so selecting the same file again still fires onChange
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  const meetsMinimum = files.length >= minRequired;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {minRequired > 0 && (
          <span className={`ml-2 text-xs font-normal ${meetsMinimum ? 'text-green-600' : 'text-gray-400'}`}>
            {files.length} / {minRequired} minimum
          </span>
        )}
      </label>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {previews.map((p, i) => (
          <div key={`${p.file.name}-${p.file.size}-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
            <img src={p.url} alt={`${label} ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
              aria-label="Remove photo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        <label
          htmlFor={id}
          className={`aspect-square rounded-lg border-2 border-dashed border-gray-300 ${colors.border} ${colors.bg} flex flex-col items-center justify-center cursor-pointer transition-colors`}
        >
          {files.length === 0 ? (
            <>
              <Camera className="w-6 h-6 text-gray-400 mb-1" />
              <span className="text-xs text-gray-500">Add photo</span>
            </>
          ) : (
            <>
              <Plus className={`w-6 h-6 ${colors.text} mb-1`} />
              <span className={`text-xs ${colors.text}`}>Add more</span>
            </>
          )}
        </label>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
        />
      </div>

      {helperText && <p className="text-xs text-gray-500 mt-2">{helperText}</p>}
    </div>
  );
}
