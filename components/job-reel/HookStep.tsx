'use client';

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { JobReelHook, JobReelState } from '@/lib/jobReel';
import { renderHookOverlayDataUrl } from '@/lib/jobReelCards';
import SectionPreview from './SectionPreview';

interface HookStepProps {
  state: JobReelState;
  updateHook: (patch: Partial<JobReelHook>) => void;
  goToStep: (step: number) => void;
}

const FIELDS: Array<{
  key: keyof JobReelHook;
  label: string;
  placeholder: string;
  multiline?: boolean;
}> = [
  { key: 'banner', label: 'Top banner', placeholder: '🚨Stop Scrolling🚨' },
  { key: 'headline', label: 'Big hook question', placeholder: 'Know SQL?' },
  {
    key: 'subtitle',
    label: 'Subtitle (3-4 lines)',
    placeholder: 'These companies are actively hiring candidates like you right now.',
    multiline: true,
  },
  { key: 'hint', label: 'Experience / skill hint', placeholder: '0-2 yrs exp' },
];

export default function HookStep({ state, updateHook, goToStep }: HookStepProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Re-render the overlay preview as you type (debounced, after fonts load)
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        await (document as any).fonts?.ready;
        const dataUrl = renderHookOverlayDataUrl(state.hook);
        if (!cancelled) setPreviewUrl(dataUrl);
      } catch (error) {
        console.error('Hook preview failed:', error);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state.hook]);

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <p className="text-sm text-white font-medium">Opening hook (section 1)</p>
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label className="text-[11px] text-gray-400 font-medium block mb-1">
              {field.label}
            </label>
            {field.multiline ? (
              <textarea
                value={state.hook[field.key]}
                onChange={(e) => updateHook({ [field.key]: e.target.value })}
                placeholder={field.placeholder}
                rows={3}
                className="input-field text-sm"
              />
            ) : (
              <input
                type="text"
                value={state.hook[field.key]}
                onChange={(e) => updateHook({ [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="input-field text-sm min-h-[44px]"
              />
            )}
          </div>
        ))}
      </div>

      {/* Live preview over the real background */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <p className="text-xs text-gray-400">Live preview — exactly how section 1 will render</p>
        <SectionPreview
          backgroundUrl={state.backgroundUrl}
          backgroundType={state.backgroundType}
          overlayDataUrl={previewUrl}
        />
      </div>

      <button
        type="button"
        onClick={() => goToStep(3)}
        className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-3 min-h-[48px] touch-manipulation"
      >
        Next: Job cards
        <ArrowRight className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => goToStep(1)}
        className="btn-ghost w-full min-h-[44px] touch-manipulation"
      >
        ← Back to background
      </button>
    </div>
  );
}
