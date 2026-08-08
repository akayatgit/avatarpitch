'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { ASPECT_RATIOS, type StudioAspectRatio, type StudioState } from '@/lib/studio';

interface ScriptStepProps {
  state: StudioState;
  updateState: (patch: Partial<StudioState>) => void;
  goToStep: (step: number) => void;
}

const RATIO_LABELS: Record<StudioAspectRatio, string> = {
  '9:16': 'Reels / Shorts',
  '16:9': 'YouTube',
  '1:1': 'Post',
};

export default function ScriptStep({ state, updateState, goToStep }: ScriptStepProps) {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (state.scenes.length > 0) {
      const confirmed = window.confirm(
        'Re-analyzing will replace your current scenes (and their videos). Continue?'
      );
      if (!confirmed) return;
    }

    setParsing(true);
    setError(null);
    try {
      const response = await fetch('/api/studio/parse-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: state.script, aspectRatio: state.aspectRatio }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to analyze the script');
      }
      updateState({
        title: data.title,
        characterPrompt: data.characterPrompt,
        scenes: data.scenes,
        step: 2,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze the script');
    } finally {
      setParsing(false);
    }
  };

  const canAnalyze = state.script.trim().length >= 10 && !parsing;

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="studio-script" className="block text-sm font-semibold text-white mb-2">
          Your script (Tamil / Tanglish)
        </label>
        <textarea
          id="studio-script"
          value={state.script}
          onChange={(e) => updateState({ script: e.target.value })}
          rows={8}
          placeholder={
            'Ungaloda script inga paste pannunga…\n\nExample:\nஒரு இளைஞன் காலையில் காபி கடையில் அமர்ந்திருக்கிறான். அவன் சொல்கிறான்: "இன்று ஒரு புது ஆரம்பம்."'
          }
          className="input-field resize-y min-h-[180px] text-sm leading-relaxed"
        />
        <p className="text-xs text-gray-500 mt-1.5">
          Scene, character, mood, dialogue — ellam ungaloda words la. AI adha scenes ah break pannum.
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-white mb-2">Video format</p>
        <div className="grid grid-cols-3 gap-2">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => updateState({ aspectRatio: ratio })}
              className={`rounded-xl border px-2 py-3 text-center transition-colors touch-manipulation min-h-[44px] ${
                state.aspectRatio === ratio
                  ? 'border-[#D1FE17] bg-[#D1FE17]/10 text-[#D1FE17]'
                  : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
              }`}
            >
              <span className="block text-sm font-bold">{ratio}</span>
              <span className="block text-[10px] mt-0.5 opacity-80">{RATIO_LABELS[ratio]}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleAnalyze}
        disabled={!canAnalyze}
        className="btn-primary w-full flex items-center justify-center gap-2 min-h-[52px] disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
      >
        {parsing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Analyzing script…
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Break into scenes
          </>
        )}
      </button>

      {state.scenes.length > 0 && !parsing && (
        <button
          type="button"
          onClick={() => goToStep(2)}
          className="btn-secondary w-full min-h-[48px] touch-manipulation"
        >
          Keep existing scenes →
        </button>
      )}
    </div>
  );
}
