'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Eraser, Loader2, RefreshCw, Wand2 } from 'lucide-react';
import type { AssemblyBuilding, AssemblyState } from '@/lib/assembly';

interface EmptyPlotStepProps {
  state: AssemblyState;
  updateBuilding: (buildingId: string, patch: Partial<AssemblyBuilding>) => void;
  goToStep: (step: number) => void;
}

const PLOT_CHECKLIST = [
  'Camera angle, horizon, and framing unchanged?',
  'Building and furniture fully removed?',
  'Ground, sidewalks, curbs, trees, and sky intact?',
  'Same lighting and shadow direction?',
];

export default function EmptyPlotStep({ state, updateBuilding, goToStep }: EmptyPlotStepProps) {
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [tailoringIds, setTailoringIds] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [promptOpenIds, setPromptOpenIds] = useState<Record<string, boolean>>({});
  const [runningAll, setRunningAll] = useState(false);

  // Always read the freshest buildings (props go stale inside the generate-all loop)
  const buildingsRef = useRef(state.buildings);
  buildingsRef.current = state.buildings;

  const anyRunning =
    runningAll ||
    Object.values(busyIds).some(Boolean) ||
    Object.values(tailoringIds).some(Boolean);

  const tailorPrompts = async (buildingId: string) => {
    const building = buildingsRef.current.find((b) => b.id === buildingId);
    if (!building?.originalImageUrl) return;

    setTailoringIds((prev) => ({ ...prev, [buildingId]: true }));
    setErrors((prev) => ({ ...prev, [buildingId]: '' }));
    try {
      const response = await fetch('/api/assembly/tailor-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: building.originalImageUrl,
          buildingName: building.name,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.removalPrompt || !data?.revealPrompt) {
        throw new Error(data?.error || 'Failed to tailor the prompts');
      }
      const patch: Partial<AssemblyBuilding> = {
        removalPrompt: data.removalPrompt,
        videoPrompt: data.revealPrompt,
      };
      // Replace placeholder names ("Building N") with the AI's property summary
      if (/^Building \d+$/.test(building.name.trim()) && data.buildingSummary) {
        patch.name = data.buildingSummary;
      }
      updateBuilding(buildingId, patch);
      setPromptOpenIds((prev) => ({ ...prev, [buildingId]: true }));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [buildingId]: err instanceof Error ? err.message : 'Failed to tailor the prompts',
      }));
    } finally {
      setTailoringIds((prev) => ({ ...prev, [buildingId]: false }));
    }
  };

  const generatePlot = async (buildingId: string) => {
    const building = buildingsRef.current.find((b) => b.id === buildingId);
    if (!building?.originalImageUrl) return;

    setBusyIds((prev) => ({ ...prev, [buildingId]: true }));
    setErrors((prev) => ({ ...prev, [buildingId]: '' }));
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenePrompt: building.removalPrompt,
          referenceImageUrls: [building.originalImageUrl],
          model: 'nano-banana',
          numImages: 1,
          // Rule 1: the empty plot must keep the exact framing of the original photo
          aspectRatio: 'match_input_image',
          size: '2K',
          persist: true,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.images?.[0]) {
        throw new Error(data?.error || 'Empty plot generation failed');
      }
      updateBuilding(buildingId, { emptyPlotUrl: data.images[0], videoUrl: null });
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [buildingId]: err instanceof Error ? err.message : 'Empty plot generation failed',
      }));
    } finally {
      setBusyIds((prev) => ({ ...prev, [buildingId]: false }));
    }
  };

  const generateAll = async () => {
    setRunningAll(true);
    try {
      for (const building of buildingsRef.current) {
        const fresh = buildingsRef.current.find((b) => b.id === building.id);
        if (fresh?.originalImageUrl && !fresh.emptyPlotUrl) {
          await generatePlot(building.id);
        }
      }
    } finally {
      setRunningAll(false);
    }
  };

  const buildings = state.buildings.filter((building) => building.originalImageUrl);
  const doneCount = buildings.filter((building) => Boolean(building.emptyPlotUrl)).length;
  const allDone = doneCount === buildings.length && buildings.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {doneCount}/{buildings.length} plot{buildings.length === 1 ? '' : 's'} cleared
        </p>
        {doneCount < buildings.length && (
          <button
            type="button"
            onClick={generateAll}
            disabled={anyRunning}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-2 min-h-[40px] disabled:opacity-40 touch-manipulation"
          >
            {runningAll ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eraser className="w-4 h-4" />
            )}
            Clear all plots
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        AI removes each building from its photo, leaving an empty plot with identical framing. The
        empty plot becomes the start frame of the reveal video. Tip: hit &ldquo;Tailor with
        AI&rdquo; first — it studies the photo and rewrites both prompts around this property&apos;s
        actual walls, signs, furniture, and ground surfaces.
      </p>

      {buildings.map((building, index) => {
        const isBusy = Boolean(busyIds[building.id]);
        const isTailoring = Boolean(tailoringIds[building.id]);
        const error = errors[building.id];
        const isPromptOpen = Boolean(promptOpenIds[building.id]);

        return (
          <div
            key={building.id}
            className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
          >
            <div className="px-4 pt-3 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#D1FE17]/15 text-[#D1FE17] text-xs font-bold flex items-center justify-center flex-shrink-0">
                {index + 1}
              </span>
              <p className="text-sm text-white font-medium truncate">{building.name}</p>
            </div>

            {/* Before / after */}
            <div className="px-4 pb-2 grid grid-cols-2 gap-2">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <img
                  src={building.originalImageUrl ?? ''}
                  alt={`${building.name} — finished`}
                  className="w-full h-full max-h-[180px] object-contain"
                />
                <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold bg-black/70 text-white rounded-full px-2 py-0.5">
                  Finished (end)
                </span>
              </div>
              <div className="relative rounded-lg overflow-hidden bg-black min-h-[100px] flex items-center justify-center">
                {building.emptyPlotUrl ? (
                  <>
                    <img
                      src={building.emptyPlotUrl}
                      alt={`${building.name} — empty plot`}
                      className="w-full h-full max-h-[180px] object-contain"
                    />
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold bg-black/70 text-[#D1FE17] rounded-full px-2 py-0.5">
                      Empty plot (start)
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-gray-600 px-2 text-center">
                    {isBusy ? 'Clearing the plot…' : 'Empty plot appears here'}
                  </span>
                )}
              </div>
            </div>

            {/* Removal prompt (editable) + AI tailoring */}
            <div className="px-4 pb-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPromptOpenIds((prev) => ({ ...prev, [building.id]: !isPromptOpen }))
                  }
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200 touch-manipulation"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${isPromptOpen ? 'rotate-180' : ''}`}
                  />
                  Removal prompt
                </button>
                <button
                  type="button"
                  onClick={() => tailorPrompts(building.id)}
                  disabled={anyRunning}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-[#D1FE17] border border-[#D1FE17]/40 rounded-full px-3 py-1.5 hover:bg-[#D1FE17]/10 disabled:opacity-40 transition-colors touch-manipulation"
                >
                  {isTailoring ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  {isTailoring ? 'Analyzing photo…' : 'Tailor with AI'}
                </button>
              </div>
              {isPromptOpen && (
                <textarea
                  value={building.removalPrompt}
                  onChange={(e) => updateBuilding(building.id, { removalPrompt: e.target.value })}
                  rows={6}
                  className="input-field text-xs leading-relaxed mt-2"
                />
              )}
            </div>

            <div className="px-4 pb-4 space-y-2">
              {isBusy ? (
                <div className="flex items-center gap-2 text-sm text-gray-300 bg-black/40 border border-gray-800 rounded-lg px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-[#D1FE17]" />
                  Removing the building (30-60s)…
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => generatePlot(building.id)}
                  disabled={anyRunning}
                  className={`${building.emptyPlotUrl ? 'btn-secondary' : 'btn-primary'} w-full flex items-center justify-center gap-2 text-sm py-2.5 min-h-[44px] disabled:opacity-40 touch-manipulation`}
                >
                  {building.emptyPlotUrl ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Regenerate empty plot
                    </>
                  ) : (
                    <>
                      <Eraser className="w-4 h-4" />
                      Clear the plot
                    </>
                  )}
                </button>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Quality checklist (Golden Rule 4) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-white mb-2">Check each empty plot:</p>
        <ul className="space-y-1.5">
          {PLOT_CHECKLIST.map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-gray-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D1FE17] flex-shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-gray-500 mt-2">
          If the perspective or ground shifted, the video will warp — regenerate until the plot
          overlays the original photo perfectly.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => goToStep(1)}
          className="btn-secondary flex-1 min-h-[48px] touch-manipulation"
        >
          ← Buildings
        </button>
        <button
          type="button"
          onClick={() => goToStep(3)}
          disabled={!allDone}
          className="btn-primary flex-[2] min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
        >
          Looks good → Reveal videos
        </button>
      </div>
    </div>
  );
}
