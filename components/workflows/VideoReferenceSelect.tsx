'use client';

import { toDisplayImageUrl } from '@/lib/imageDisplay';

export type VideoReferenceSource = 'original' | 'path';

interface Props {
  value: VideoReferenceSource;
  onChange: (source: VideoReferenceSource) => void;
  originalImageUrl: string | null;
  pathImageUrl: string | null;
  disabled?: boolean;
  className?: string;
  /** Show hint that Grok keeps red lines if path is selected */
  showGrokHint?: boolean;
}

/**
 * Pick which still is sent as the video first-frame / primary ref:
 * clean original vs path-annotated (red line).
 */
export default function VideoReferenceSelect({
  value,
  onChange,
  originalImageUrl,
  pathImageUrl,
  disabled,
  className = '',
  showGrokHint,
}: Props) {
  const preview =
    value === 'path' && pathImageUrl
      ? pathImageUrl
      : originalImageUrl;

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-white mb-2">
        Reference image for video
      </label>
      <select
        value={value}
        disabled={disabled || (!originalImageUrl && !pathImageUrl)}
        onChange={(e) => onChange(e.target.value as VideoReferenceSource)}
        className="input-field"
      >
        <option value="original" disabled={!originalImageUrl}>
          Original (no red path)
        </option>
        <option value="path" disabled={!pathImageUrl}>
          With path (red line)
        </option>
      </select>
      {showGrokHint && value === 'path' && (
        <p className="mt-1 text-[11px] text-amber-300/90">
          Grok often keeps the red line visible — prefer Original for Grok.
        </p>
      )}
      {value === 'original' && (
        <p className="mt-1 text-[11px] text-gray-500">
          Clean still without the drawn path — best for Grok Imagine.
        </p>
      )}
      {preview && (
        <div className="mt-3 max-w-[140px] aspect-[9/16] rounded-lg border border-gray-700 overflow-hidden bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              preview.startsWith('data:') ? preview : toDisplayImageUrl(preview)
            }
            alt={value === 'path' ? 'Path reference' : 'Original reference'}
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
}
