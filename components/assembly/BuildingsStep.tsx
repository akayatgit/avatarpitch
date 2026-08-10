'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import {
  ASSEMBLY_ASPECT_RATIOS,
  MAX_BUILDINGS,
  createAssemblyBuilding,
  type AssemblyAspectRatio,
  type AssemblyBuilding,
  type AssemblyState,
} from '@/lib/assembly';

interface BuildingsStepProps {
  state: AssemblyState;
  updateState: (patch: Partial<AssemblyState>) => void;
  updateBuilding: (buildingId: string, patch: Partial<AssemblyBuilding>) => void;
  goToStep: (step: number) => void;
}

const RATIO_LABELS: Record<AssemblyAspectRatio, string> = {
  '16:9': 'Landscape',
  '9:16': 'Reels / Shorts',
  '1:1': 'Post',
};

const GOLDEN_RULES = [
  'Same framing & crop — the empty plot must match the finished photo exactly',
  'Clean, well-lit photos — crisp daylight or balanced dusk, no blur',
  'Keep the environment — ground, sidewalks, trees, and sky stay intact',
  'Verify the empty plot before animating — regenerate until it matches',
];

export default function BuildingsStep({
  state,
  updateState,
  updateBuilding,
  goToStep,
}: BuildingsStepProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [generateForId, setGenerateForId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const setError = (buildingId: string, message: string) =>
    setErrors((prev) => ({ ...prev, [buildingId]: message }));

  const setBuildingCount = (count: number) => {
    const buildings = [...state.buildings];
    while (buildings.length < count) {
      buildings.push(createAssemblyBuilding(buildings.length));
    }
    updateState({ buildings: buildings.slice(0, count) });
  };

  const addBuilding = () => {
    if (state.buildings.length >= MAX_BUILDINGS) return;
    updateState({ buildings: [...state.buildings, createAssemblyBuilding(state.buildings.length)] });
  };

  const removeBuilding = (buildingId: string) => {
    if (state.buildings.length <= 1) return;
    updateState({ buildings: state.buildings.filter((building) => building.id !== buildingId) });
  };

  const handleUpload = async (buildingId: string, file: File) => {
    setBusyId(buildingId);
    setError(buildingId, '');
    try {
      const formData = new FormData();
      formData.append('images', file);
      const response = await fetch('/api/upload-image', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Upload failed');
      }
      updateBuilding(buildingId, {
        originalImageUrl: data.url,
        originalImageSource: 'upload',
        emptyPlotUrl: null,
        videoUrl: null,
      });
    } catch (err) {
      setError(buildingId, err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleGenerate = async (building: AssemblyBuilding) => {
    if (!building.buildingPrompt.trim()) {
      setError(building.id, 'Describe the finished building first.');
      return;
    }
    setBusyId(building.id);
    setError(building.id, '');
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenePrompt: `Photorealistic architectural exterior photography of a finished modern building: ${building.buildingPrompt}. Eye-level wide shot showing the full property and its surrounding ground surface (pavement, sidewalk, landscaping), natural daylight, clean composition, no people.`,
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
      updateBuilding(building.id, {
        originalImageUrl: data.images[0],
        originalImageSource: 'generated',
        emptyPlotUrl: null,
        videoUrl: null,
      });
      setGenerateForId(null);
    } catch (err) {
      setError(building.id, err instanceof Error ? err.message : 'Image generation failed');
    } finally {
      setBusyId(null);
    }
  };

  const readyCount = state.buildings.filter((building) => building.originalImageUrl).length;
  const canContinue = readyCount === state.buildings.length && readyCount > 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-400">
        Add a photo of each finished property. We&apos;ll clear the plot with AI, then animate the
        building constructing itself out of the empty land.
      </p>

      {/* Project title */}
      <div>
        <label htmlFor="assembly-title" className="block text-sm font-semibold text-white mb-2">
          Project name
        </label>
        <input
          id="assembly-title"
          type="text"
          value={state.title}
          onChange={(e) => updateState({ title: e.target.value })}
          placeholder="e.g. Marina Street storefronts"
          className="input-field text-sm"
        />
      </div>

      {/* Aspect ratio */}
      <div>
        <p className="text-sm font-semibold text-white mb-2">Video format</p>
        <div className="grid grid-cols-3 gap-2">
          {ASSEMBLY_ASPECT_RATIOS.map((ratio) => (
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

      {/* Number of buildings */}
      <div>
        <p className="text-sm font-semibold text-white mb-2">How many buildings?</p>
        <div className="flex items-center gap-2 flex-wrap">
          {Array.from({ length: MAX_BUILDINGS }, (_, index) => index + 1).map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setBuildingCount(count)}
              className={`w-11 h-11 rounded-xl border text-sm font-bold transition-colors touch-manipulation ${
                state.buildings.length === count
                  ? 'border-[#D1FE17] bg-[#D1FE17]/10 text-[#D1FE17]'
                  : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
              }`}
            >
              {count}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          Pick a number, or just keep adding reference photos below — one building per photo.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const targetId = uploadTargetRef.current;
          if (file && targetId) void handleUpload(targetId, file);
          e.target.value = '';
        }}
      />

      {/* Building cards */}
      <div className="space-y-3">
        {state.buildings.map((building, index) => {
          const isBusy = busyId === building.id;
          const error = errors[building.id];
          const isGenerateOpen = generateForId === building.id;

          return (
            <div
              key={building.id}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="w-6 h-6 rounded-full bg-[#D1FE17]/15 text-[#D1FE17] text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={building.name}
                    onChange={(e) => updateBuilding(building.id, { name: e.target.value })}
                    className="bg-transparent text-sm text-white font-medium focus:outline-none focus:border-b focus:border-gray-600 min-w-0 flex-1"
                    aria-label={`Building ${index + 1} name`}
                  />
                </div>
                {state.buildings.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBuilding(building.id)}
                    className="text-gray-500 hover:text-red-400 p-1.5 touch-manipulation"
                    aria-label={`Remove ${building.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="px-4 pb-4">
                {building.originalImageUrl ? (
                  <div className="relative rounded-lg overflow-hidden">
                    <img
                      src={building.originalImageUrl}
                      alt={`${building.name} — finished property`}
                      className="w-full max-h-[280px] object-contain bg-black"
                    />
                    <span className="absolute top-2 left-2 text-[10px] font-semibold bg-black/70 text-white rounded-full px-2 py-1">
                      {building.originalImageSource === 'upload' ? 'Uploaded photo' : 'AI generated'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateBuilding(building.id, {
                          originalImageUrl: null,
                          originalImageSource: null,
                          emptyPlotUrl: null,
                          videoUrl: null,
                        })
                      }
                      className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1.5 hover:bg-black touch-manipulation"
                      aria-label="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : isGenerateOpen ? (
                  <div className="space-y-2">
                    <textarea
                      value={building.buildingPrompt}
                      onChange={(e) => updateBuilding(building.id, { buildingPrompt: e.target.value })}
                      rows={3}
                      className="input-field text-sm leading-relaxed"
                      placeholder="A minimalist white cafe with floor-to-ceiling glass windows, wooden slat panels, and outdoor seating on a gravel yard…"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleGenerate(building)}
                        disabled={isBusy}
                        className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm py-2.5 min-h-[44px] disabled:opacity-40 touch-manipulation"
                      >
                        {isBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        Generate building
                      </button>
                      <button
                        type="button"
                        onClick={() => setGenerateForId(null)}
                        disabled={isBusy}
                        className="btn-ghost px-4 min-h-[44px] touch-manipulation"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        uploadTargetRef.current = building.id;
                        fileInputRef.current?.click();
                      }}
                      disabled={isBusy}
                      className="bg-black border border-gray-700 rounded-lg p-4 text-center hover:border-[#D1FE17]/60 transition-colors disabled:opacity-40 touch-manipulation"
                    >
                      {isBusy ? (
                        <Loader2 className="w-5 h-5 text-[#D1FE17] animate-spin mx-auto mb-1" />
                      ) : (
                        <Camera className="w-5 h-5 text-[#D1FE17] mx-auto mb-1" />
                      )}
                      <span className="block text-xs font-semibold text-white">Upload photo</span>
                      <span className="block text-[10px] text-gray-500 mt-0.5">
                        Finished property
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenerateForId(building.id)}
                      disabled={isBusy}
                      className="bg-black border border-gray-700 rounded-lg p-4 text-center hover:border-[#D1FE17]/60 transition-colors disabled:opacity-40 touch-manipulation"
                    >
                      <Sparkles className="w-5 h-5 text-[#D1FE17] mx-auto mb-1" />
                      <span className="block text-xs font-semibold text-white">Generate with AI</span>
                      <span className="block text-[10px] text-gray-500 mt-0.5">
                        Describe the building
                      </span>
                    </button>
                  </div>
                )}

                {error && (
                  <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2 mt-2">
                    {error}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {state.buildings.length < MAX_BUILDINGS && (
        <button
          type="button"
          onClick={addBuilding}
          className="btn-secondary w-full flex items-center justify-center gap-2 min-h-[44px] touch-manipulation"
        >
          <Plus className="w-4 h-4" />
          Add another building
        </button>
      )}

      {/* Golden rules from the guide */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-white mb-2">Four golden rules for clean reveals:</p>
        <ul className="space-y-1.5">
          {GOLDEN_RULES.map((rule) => (
            <li key={rule} className="flex items-start gap-2 text-xs text-gray-400">
              <span className="text-[#D1FE17] flex-shrink-0 mt-0.5">•</span>
              {rule}
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => goToStep(2)}
        disabled={!canContinue}
        className="btn-primary w-full min-h-[52px] disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
      >
        {canContinue
          ? `Clear the plot${state.buildings.length > 1 ? 's' : ''} →`
          : `Add ${state.buildings.length - readyCount} more photo${state.buildings.length - readyCount === 1 ? '' : 's'} to continue`}
      </button>
    </div>
  );
}
