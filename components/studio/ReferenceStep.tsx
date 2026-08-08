'use client';

import { useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import type { StudioState } from '@/lib/studio';

interface ReferenceStepProps {
  state: StudioState;
  updateState: (patch: Partial<StudioState>) => void;
  goToStep: (step: number) => void;
}

const QUALITY_CHECKLIST = [
  'Face / subject sharp ah clear ah irukka?',
  'Oru clear light direction (no confusing shadows)?',
  'Background clean / simple ah irukka?',
  'Full subject frame kulla irukka (cut aagala)?',
];

export default function ReferenceStep({ state, updateState, goToStep }: ReferenceStepProps) {
  const [mode, setMode] = useState<'choose' | 'generate'>('choose');
  const [busy, setBusy] = useState<'upload' | 'generate' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async (file: File) => {
    setBusy('upload');
    setError(null);
    try {
      const formData = new FormData();
      formData.append('images', file);
      const response = await fetch('/api/upload-image', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Upload failed');
      }
      updateState({ referenceImageUrl: data.url, referenceImageSource: 'upload' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(null);
    }
  };

  const handleGenerate = async () => {
    if (!state.characterPrompt.trim()) {
      setError('Describe your character first.');
      return;
    }
    setBusy('generate');
    setError(null);
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenePrompt: state.characterPrompt,
          referenceImageUrls: [],
          model: 'gpt-image-2',
          numImages: 1,
          aspectRatio: state.aspectRatio,
          size: '2K',
          persist: true,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.images?.[0]) {
        throw new Error(data?.error || 'Image generation failed');
      }
      updateState({ referenceImageUrl: data.images[0], referenceImageSource: 'generated' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed');
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = () => {
    updateState({ referenceImageUrl: null, referenceImageSource: null });
    setMode('choose');
  };

  // ---- Review state: image chosen, quality check ----
  if (state.referenceImageUrl) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          Idha than ella scene la um character consistency ku use pannuvom (ingredient image).
        </p>

        <div className="relative bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <img
            src={state.referenceImageUrl}
            alt="Reference"
            className="w-full max-h-[420px] object-contain bg-black"
          />
          <span className="absolute top-2 left-2 text-[10px] font-semibold bg-black/70 text-white rounded-full px-2 py-1">
            {state.referenceImageSource === 'upload' ? 'Uploaded photo' : 'AI generated'}
          </span>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1.5 hover:bg-black touch-manipulation"
            aria-label="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-white mb-2">Quality check pannunga:</p>
          <ul className="space-y-1.5">
            {QUALITY_CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-gray-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#D1FE17] flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-gray-500 mt-2">
            Ithu sari illana video la character face mosama varum — regenerate or vera photo try
            pannunga.
          </p>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {state.referenceImageSource === 'generated' && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy !== null}
            className="btn-secondary w-full flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-40 touch-manipulation"
          >
            {busy === 'generate' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Regenerate
          </button>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => goToStep(2)}
            className="btn-secondary flex-1 min-h-[48px] touch-manipulation"
          >
            ← Scenes
          </button>
          <button
            type="button"
            onClick={() => goToStep(4)}
            className="btn-primary flex-[2] min-h-[48px] touch-manipulation"
          >
            Looks good → Videos
          </button>
        </div>
      </div>
    );
  }

  // ---- Generate mode: editable character prompt ----
  if (mode === 'generate') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          AI oda character description (script la irundhu). Venumna edit pannunga, aprom generate.
        </p>
        <textarea
          value={state.characterPrompt}
          onChange={(e) => updateState({ characterPrompt: e.target.value })}
          rows={6}
          className="input-field text-sm leading-relaxed"
          placeholder="A young South Indian man in his mid-20s, wearing a simple white cotton shirt…"
        />

        {error && (
          <div className="bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy !== null}
          className="btn-primary w-full flex items-center justify-center gap-2 min-h-[52px] disabled:opacity-40 touch-manipulation"
        >
          {busy === 'generate' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating (30-60s)…
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate character image
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setMode('choose')}
          disabled={busy !== null}
          className="btn-ghost w-full min-h-[44px] touch-manipulation"
        >
          ← Back
        </button>
      </div>
    );
  }

  // ---- Choose mode: upload vs generate ----
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Ungaloda character / subject oda reference photo venum. Idha vechi than ella video scene
        layum same character varum.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
          e.target.value = '';
        }}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy !== null}
        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-5 text-left hover:border-[#D1FE17]/60 transition-colors disabled:opacity-40 touch-manipulation"
      >
        <div className="flex items-center gap-4">
          <span className="w-12 h-12 rounded-xl bg-[#D1FE17]/10 flex items-center justify-center flex-shrink-0">
            {busy === 'upload' ? (
              <Loader2 className="w-6 h-6 text-[#D1FE17] animate-spin" />
            ) : (
              <Camera className="w-6 h-6 text-[#D1FE17]" />
            )}
          </span>
          <span>
            <span className="block text-sm font-semibold text-white">Upload a photo</span>
            <span className="block text-xs text-gray-400 mt-0.5">
              Camera / gallery la irundhu — ungaloda own photo or subject photo
            </span>
          </span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setMode('generate')}
        disabled={busy !== null}
        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-5 text-left hover:border-[#D1FE17]/60 transition-colors disabled:opacity-40 touch-manipulation"
      >
        <div className="flex items-center gap-4">
          <span className="w-12 h-12 rounded-xl bg-[#D1FE17]/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-[#D1FE17]" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-white">Generate with AI</span>
            <span className="block text-xs text-gray-400 mt-0.5">
              Script la irukura character ah AI create pannum
            </span>
          </span>
        </div>
      </button>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => goToStep(2)}
        className="btn-ghost w-full min-h-[44px] touch-manipulation"
      >
        ← Back to scenes
      </button>
    </div>
  );
}
