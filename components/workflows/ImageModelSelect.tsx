'use client';

import { IMAGE_MODELS, type ImageModelId } from '@/lib/tools/imageModels';

interface Props {
  value: ImageModelId;
  onChange: (id: ImageModelId) => void;
  disabled?: boolean;
  className?: string;
}

/** Chip-style picker for image generation model. */
export default function ImageModelSelect({ value, onChange, disabled, className = '' }: Props) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {IMAGE_MODELS.map((m) => (
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
          {m.shortName}
        </button>
      ))}
    </div>
  );
}
