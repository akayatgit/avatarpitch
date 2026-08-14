'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import {
  MAX_SECTION_SECONDS,
  MIN_SECTION_SECONDS,
  type JobReelHook,
  type JobReelState,
} from '@/lib/jobReel';
import { renderHookOverlayDataUrl, type HookStage } from '@/lib/jobReelCards';
import SectionPreview from './SectionPreview';
import SectionBackgroundPicker from './SectionBackgroundPicker';

interface HookStepProps {
  state: JobReelState;
  updateHook: (patch: Partial<JobReelHook>) => void;
  updateState: (patch: Partial<JobReelState>) => void;
  goToStep: (step: number) => void;
}

const FIELDS: Array<{
  key: keyof JobReelHook;
  label: string;
  placeholder: string;
  multiline?: boolean;
  /** Timing hint shown next to the label. */
  timing: 'start' | 'reveal';
}> = [
  { key: 'banner', label: 'Top banner', placeholder: '🚨Stop Scrolling🚨', timing: 'start' },
  { key: 'headline', label: 'Big hook question', placeholder: 'Know SQL?', timing: 'start' },
  {
    key: 'subtitle',
    label: 'Subtitle (3-4 lines)',
    placeholder: 'These companies are actively hiring candidates like you right now.',
    multiline: true,
    timing: 'reveal',
  },
  { key: 'hint', label: 'Experience / skill hint', placeholder: '0-2 yrs exp', timing: 'reveal' },
];

function InlineStepper({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-gray-300">{label}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))}
          disabled={value <= min}
          className="w-9 h-9 rounded-lg border border-gray-700 text-gray-300 flex items-center justify-center disabled:opacity-30 touch-manipulation"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="text-sm text-white font-semibold w-12 text-center">{format(value)}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, Math.round((value + step) * 10) / 10))}
          disabled={value >= max}
          className="w-9 h-9 rounded-lg border border-gray-700 text-gray-300 flex items-center justify-center disabled:opacity-30 touch-manipulation"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function HookStep({ state, updateHook, updateState, goToStep }: HookStepProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewStage, setPreviewStage] = useState<HookStage>('full');

  const revealSec = Math.min(state.hookRevealSec, state.hookDurationSec - 0.5);

  // Re-render the overlay preview as you type (debounced, after fonts load)
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        await (document as any).fonts?.ready;
        const dataUrl = renderHookOverlayDataUrl(state.hook, previewStage);
        if (!cancelled) setPreviewUrl(dataUrl);
      } catch (error) {
        console.error('Hook preview failed:', error);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state.hook, previewStage]);

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <p className="text-sm text-white font-medium">Opening hook (section 1)</p>
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label className="text-[11px] text-gray-400 font-medium mb-1 flex items-center justify-between">
              <span>{field.label}</span>
              <span className="text-[10px] text-gray-500">
                {field.timing === 'start' ? 'from 0:00' : `appears at ${revealSec}s`}
              </span>
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

      {/* Timing — banner + headline first, the rest pops in, then job cards */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
        <p className="text-sm text-white font-medium">Section timing</p>
        <InlineStepper
          label="Reveal subtitle & hint at"
          value={revealSec}
          min={0.5}
          max={Math.max(0.5, state.hookDurationSec - 0.5)}
          step={0.5}
          format={(value) => `${value}s`}
          onChange={(value) => updateState({ hookRevealSec: value })}
        />
        <InlineStepper
          label="Hook section total"
          value={state.hookDurationSec}
          min={MIN_SECTION_SECONDS}
          max={MAX_SECTION_SECONDS}
          step={1}
          format={(value) => `${value}s`}
          onChange={(value) => updateState({ hookDurationSec: value })}
        />
        <p className="text-[11px] text-gray-500">
          0:00 — banner + hook question · {revealSec}s — subtitle + hint pop in ·{' '}
          {state.hookDurationSec}s — job card 1 starts
        </p>
      </div>

      {/* Optional per-section background */}
      <SectionBackgroundPicker
        currentUrl={state.hookBackgroundUrl}
        currentType={state.hookBackgroundType}
        onChange={(background) =>
          updateState({
            hookBackgroundUrl: background?.url ?? null,
            hookBackgroundType: background?.type ?? null,
          })
        }
      />

      {/* Live preview over the real background, per reveal stage */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">Live preview</p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPreviewStage('top')}
              className={`text-[10px] px-2.5 py-1.5 rounded-full border touch-manipulation ${
                previewStage === 'top'
                  ? 'border-[#D1FE17] text-[#D1FE17] bg-[#D1FE17]/10'
                  : 'border-gray-700 text-gray-400'
              }`}
            >
              0–{revealSec}s
            </button>
            <button
              type="button"
              onClick={() => setPreviewStage('full')}
              className={`text-[10px] px-2.5 py-1.5 rounded-full border touch-manipulation ${
                previewStage === 'full'
                  ? 'border-[#D1FE17] text-[#D1FE17] bg-[#D1FE17]/10'
                  : 'border-gray-700 text-gray-400'
              }`}
            >
              after {revealSec}s
            </button>
          </div>
        </div>
        <SectionPreview
          backgroundUrl={state.hookBackgroundUrl ?? state.backgroundUrl}
          backgroundType={state.hookBackgroundUrl ? state.hookBackgroundType : state.backgroundType}
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
