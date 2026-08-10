'use client';

import { useRef, useState } from 'react';
import { ChevronDown, Clapperboard, Download, Loader2, RefreshCw } from 'lucide-react';
import type { AssemblyBuilding, AssemblyState, AssemblyVideoModel } from '@/lib/assembly';

interface RevealVideoStepProps {
  state: AssemblyState;
  projectId: string | null;
  updateBuilding: (buildingId: string, patch: Partial<AssemblyBuilding>) => void;
  goToStep: (step: number) => void;
}

export default function RevealVideoStep({
  state,
  projectId,
  updateBuilding,
  goToStep,
}: RevealVideoStepProps) {
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [promptOpenIds, setPromptOpenIds] = useState<Record<string, boolean>>({});
  const [runningAll, setRunningAll] = useState(false);

  // Always read the freshest buildings (props go stale inside the generate-all loop)
  const buildingsRef = useRef(state.buildings);
  buildingsRef.current = state.buildings;

  const anyRunning = runningAll || Object.values(busyIds).some(Boolean);

  const generateVideo = async (buildingId: string) => {
    const building = buildingsRef.current.find((b) => b.id === buildingId);
    if (!building?.emptyPlotUrl || !building.originalImageUrl) return;

    setBusyIds((prev) => ({ ...prev, [buildingId]: true }));
    setErrors((prev) => ({ ...prev, [buildingId]: '' }));
    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Reference 1 (empty plot) is the start frame; Reference 2 (finished photo) is the end frame
          imageUrls: [building.emptyPlotUrl],
          lastFrameImage: building.originalImageUrl,
          prompt: building.videoPrompt,
          model: building.videoModel,
          aspectRatio: state.aspectRatio,
          resolution: '720p',
          duration: 8,
          cameraFixed: true,
          generateAudio: false,
          projectId,
          buildingId,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.videoUrl) {
        throw new Error(data?.error || 'Video generation failed');
      }
      updateBuilding(buildingId, { videoUrl: data.videoUrl });
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [buildingId]: err instanceof Error ? err.message : 'Video generation failed',
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
        if (fresh?.emptyPlotUrl && !fresh.videoUrl) {
          await generateVideo(building.id);
        }
      }
    } finally {
      setRunningAll(false);
    }
  };

  const buildings = state.buildings.filter(
    (building) => building.originalImageUrl && building.emptyPlotUrl
  );
  const doneCount = buildings.filter((building) => Boolean(building.videoUrl)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {doneCount}/{buildings.length} reveal{buildings.length === 1 ? '' : 's'} ready
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
              <Clapperboard className="w-4 h-4" />
            )}
            Generate all
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        8-second construction reveal: the video starts on the empty plot and the building assembles
        itself piece by piece until it matches your original photo exactly.
      </p>

      {buildings.map((building, index) => {
        const isBusy = Boolean(busyIds[building.id]);
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

            {/* Model toggle */}
            <div className="px-4 pb-2 flex items-center gap-2">
              {(
                [
                  { value: 'seedance-1-pro-fast', label: 'Fast' },
                  { value: 'veo-3.1', label: 'Veo 3.1' },
                ] as Array<{ value: AssemblyVideoModel; label: string }>
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={isBusy}
                  onClick={() => updateBuilding(building.id, { videoModel: option.value })}
                  className={`text-[11px] rounded-full px-3 py-1.5 border transition-colors touch-manipulation ${
                    building.videoModel === option.value
                      ? 'border-[#D1FE17] bg-[#D1FE17]/10 text-[#D1FE17]'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Reveal prompt (editable) */}
            <div className="px-4 pb-2">
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
                Reveal animation prompt
              </button>
              {isPromptOpen && (
                <textarea
                  value={building.videoPrompt}
                  onChange={(e) => updateBuilding(building.id, { videoPrompt: e.target.value })}
                  rows={10}
                  className="input-field text-xs leading-relaxed mt-2"
                />
              )}
            </div>

            {/* Output area */}
            <div className="px-4 pb-4">
              {building.videoUrl ? (
                <div className="space-y-2">
                  <video
                    src={building.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full rounded-lg bg-black max-h-[420px]"
                  />
                  <div className="flex gap-2">
                    <a
                      href={building.videoUrl}
                      download={`${building.name.replace(/\s+/g, '-').toLowerCase() || `building-${index + 1}`}-reveal.mp4`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm py-2.5 min-h-[44px] touch-manipulation"
                    >
                      <Download className="w-4 h-4" />
                      Save video
                    </a>
                    <button
                      type="button"
                      disabled={anyRunning}
                      onClick={() => generateVideo(building.id)}
                      className="btn-secondary flex items-center justify-center gap-2 text-sm py-2.5 px-4 min-h-[44px] disabled:opacity-40 touch-manipulation"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Redo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Start / end frames going into the video */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative rounded-lg overflow-hidden bg-black">
                      <img
                        src={building.emptyPlotUrl ?? ''}
                        alt={`${building.name} — start frame`}
                        className="w-full max-h-[140px] object-contain"
                      />
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold bg-black/70 text-white rounded-full px-2 py-0.5">
                        Start (0s)
                      </span>
                    </div>
                    <div className="relative rounded-lg overflow-hidden bg-black">
                      <img
                        src={building.originalImageUrl ?? ''}
                        alt={`${building.name} — end frame`}
                        className="w-full max-h-[140px] object-contain"
                      />
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold bg-black/70 text-white rounded-full px-2 py-0.5">
                        End (8s)
                      </span>
                    </div>
                  </div>

                  {isBusy ? (
                    <div className="flex items-center gap-2 text-sm text-gray-300 bg-black/40 border border-gray-800 rounded-lg px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-[#D1FE17]" />
                      Building the reveal animation (1-3 min)…
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={anyRunning}
                      onClick={() => generateVideo(building.id)}
                      className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2.5 min-h-[44px] disabled:opacity-40 touch-manipulation"
                    >
                      <Clapperboard className="w-4 h-4" />
                      Generate reveal video
                    </button>
                  )}

                  {error && (
                    <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => goToStep(2)}
        className="btn-ghost w-full min-h-[44px] touch-manipulation"
      >
        ← Back to empty plots
      </button>
    </div>
  );
}
