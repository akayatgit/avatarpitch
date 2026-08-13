'use client';

import { VIDEO_MODELS, type VideoModelId } from '@/lib/tools/videoModels';

interface Props {
  value: VideoModelId;
  onChange: (id: VideoModelId) => void;
  className?: string;
  disabled?: boolean;
}

/** Chip-style picker for video generation model. */
export default function VideoModelSelect({ value, onChange, className = '', disabled }: Props) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {VIDEO_MODELS.map((m) => (
        <button
          key={m.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(m.id)}
          className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 disabled:opacity-40 ${
            value === m.id
              ? 'bg-[#D1FE17] text-black'
              : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
          }`}
        >
          {m.name}
        </button>
      ))}
    </div>
  );
}
