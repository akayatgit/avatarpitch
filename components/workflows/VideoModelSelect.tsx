'use client';

import {
  VIDEO_MODELS,
  type VideoModelId,
} from '@/lib/tools/videoModels';

interface Props {
  value: VideoModelId;
  onChange: (id: VideoModelId) => void;
  className?: string;
  disabled?: boolean;
}

/** Dropdown to pick which Replicate video model to run (extensible). */
export default function VideoModelSelect({
  value,
  onChange,
  className = '',
  disabled,
}: Props) {
  const current = VIDEO_MODELS.find((m) => m.id === value) ?? VIDEO_MODELS[0];

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-white mb-2">Video model</label>
      <select
        value={current.id}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as VideoModelId)}
        className="input-field"
      >
        {VIDEO_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[11px] text-gray-500">{current.description}</p>
    </div>
  );
}
