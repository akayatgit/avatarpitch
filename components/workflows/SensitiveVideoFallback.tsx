'use client';

import {
  SENSITIVE_FALLBACK_MODEL_ID,
  getVideoModel,
  type VideoModelId,
} from '@/lib/tools/videoModels';

interface Props {
  suggestedModel?: VideoModelId | string | null;
  onSwitchAndRetry: (modelId: VideoModelId) => void;
  disabled?: boolean;
}

/** Shown when Seedance (or another model) returns a sensitive-content / E005 failure. */
export default function SensitiveVideoFallback({
  suggestedModel,
  onSwitchAndRetry,
  disabled,
}: Props) {
  const fallbackId =
    (suggestedModel as VideoModelId) || SENSITIVE_FALLBACK_MODEL_ID;
  const fallback = getVideoModel(fallbackId);

  return (
    <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 p-4 space-y-3">
      <p className="text-sm text-amber-200">
        This model flagged the input as sensitive. Switch to{' '}
        <span className="font-semibold text-white">{fallback.name}</span> and try again —
        or pick another model from the dropdown above.
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSwitchAndRetry(fallback.id)}
        className="w-full btn-primary disabled:opacity-50 min-h-[40px]"
      >
        Switch to {fallback.name} &amp; retry
      </button>
    </div>
  );
}
