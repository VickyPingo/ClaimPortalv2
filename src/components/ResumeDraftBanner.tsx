import { Clock, RotateCcw, X } from 'lucide-react';

interface ResumeDraftBannerProps {
  savedAt: number;
  onResume: () => void;
  onDiscard: () => void;
}

function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function ResumeDraftBanner({ savedAt, onResume, onDiscard }: ResumeDraftBannerProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-green-700" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Continue your claim?</h2>
        <p className="text-gray-600 text-sm mb-1">
          You started this claim {timeAgo(savedAt)} but didn't finish.
        </p>
        <p className="text-gray-500 text-xs mb-6">
          We saved your progress, including any photos you'd already added.
        </p>

        <div className="space-y-3">
          <button
            onClick={onResume}
            className="w-full bg-green-700 text-white py-2.5 rounded-lg font-semibold hover:bg-green-800 flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Continue where I left off
          </button>
          <button
            onClick={onDiscard}
            className="w-full text-gray-600 py-2.5 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
          >
            <X className="w-4 h-4" />
            Start over instead
          </button>
        </div>
      </div>
    </div>
  );
}
