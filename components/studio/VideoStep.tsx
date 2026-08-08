'use client';

import { useRef, useState } from 'react';
import { Clapperboard, Download, Loader2, Mic, RefreshCw } from 'lucide-react';
import type { StudioScene, StudioState, StudioVideoModel } from '@/lib/studio';

interface VideoStepProps {
  state: StudioState;
  projectId: string | null;
  updateScene: (sceneId: string, patch: Partial<StudioScene>) => void;
  goToStep: (step: number) => void;
}

type ScenePhase = 'idle' | 'frame' | 'video' | 'error';

export default function VideoStep({ state, projectId, updateScene, goToStep }: VideoStepProps) {
  const [phases, setPhases] = useState<Record<string, ScenePhase>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [runningAll, setRunningAll] = useState(false);

  // Always read the freshest scenes (props go stale inside the generate-all loop)
  const scenesRef = useRef(state.scenes);
  scenesRef.current = state.scenes;

  const anyRunning =
    runningAll || Object.values(phases).some((phase) => phase === 'frame' || phase === 'video');

  const setPhase = (sceneId: string, phase: ScenePhase) =>
    setPhases((prev) => ({ ...prev, [sceneId]: phase }));

  const generateScene = async (sceneId: string, options?: { regenerateFrame?: boolean }) => {
    const scene = scenesRef.current.find((s) => s.id === sceneId);
    if (!scene || !state.referenceImageUrl) return;

    setErrors((prev) => ({ ...prev, [sceneId]: '' }));
    try {
      // Stage 1 — scene first frame: reference image + scene prompt
      let frameUrl = scene.frameUrl;
      if (!frameUrl || options?.regenerateFrame) {
        setPhase(sceneId, 'frame');
        const frameResponse = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenePrompt: scene.imagePrompt,
            referenceImageUrls: [state.referenceImageUrl],
            model: 'nano-banana',
            numImages: 1,
            aspectRatio: state.aspectRatio,
            size: '2K',
            persist: true,
          }),
        });
        const frameData = await frameResponse.json();
        if (!frameResponse.ok || !frameData?.images?.[0]) {
          throw new Error(frameData?.error || 'Failed to create the scene frame');
        }
        frameUrl = frameData.images[0] as string;
        updateScene(sceneId, { frameUrl, videoUrl: null });
      }

      // Stage 2 — animate the frame
      setPhase(sceneId, 'video');
      const isVeo = scene.videoModel === 'veo-3.1';
      const videoResponse = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls: [frameUrl],
          prompt: scene.videoPrompt,
          model: scene.videoModel,
          aspectRatio: state.aspectRatio,
          resolution: '720p',
          duration: isVeo ? 6 : 5,
          cameraFixed: false,
          generateAudio: isVeo && Boolean(scene.dialogue),
          projectId,
          sceneId,
        }),
      });
      const videoData = await videoResponse.json();
      if (!videoResponse.ok || !videoData?.videoUrl) {
        throw new Error(videoData?.error || 'Video generation failed');
      }
      updateScene(sceneId, { videoUrl: videoData.videoUrl });
      setPhase(sceneId, 'idle');
    } catch (err) {
      setPhase(sceneId, 'error');
      setErrors((prev) => ({
        ...prev,
        [sceneId]: err instanceof Error ? err.message : 'Generation failed',
      }));
    }
  };

  const generateAll = async () => {
    setRunningAll(true);
    try {
      for (const scene of scenesRef.current) {
        const fresh = scenesRef.current.find((s) => s.id === scene.id);
        if (!fresh?.videoUrl) {
          await generateScene(scene.id);
        }
      }
    } finally {
      setRunningAll(false);
    }
  };

  const doneCount = state.scenes.filter((scene) => Boolean(scene.videoUrl)).length;
  const pendingCount = state.scenes.length - doneCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {doneCount}/{state.scenes.length} clips ready
        </p>
        {pendingCount > 0 && (
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

      {state.scenes.map((scene, index) => {
        const phase = phases[scene.id] ?? 'idle';
        const isBusy = phase === 'frame' || phase === 'video';
        const error = errors[scene.id];

        return (
          <div key={scene.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-[#D1FE17]/15 text-[#D1FE17] text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {index + 1}
                </span>
                <p className="text-sm text-white font-medium line-clamp-2">{scene.summary}</p>
              </div>
              {scene.dialogue && (
                <p className="text-xs text-gray-400 pl-8 italic">&ldquo;{scene.dialogue}&rdquo;</p>
              )}
            </div>

            {/* Model toggle */}
            <div className="px-4 pb-2 flex items-center gap-2">
              {(
                [
                  { value: 'seedance-1-pro-fast', label: 'Fast' },
                  { value: 'veo-3.1', label: 'Veo 3.1 + voice' },
                ] as Array<{ value: StudioVideoModel; label: string }>
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={isBusy}
                  onClick={() => updateScene(scene.id, { videoModel: option.value })}
                  className={`text-[11px] rounded-full px-3 py-1.5 border transition-colors touch-manipulation ${
                    scene.videoModel === option.value
                      ? 'border-[#D1FE17] bg-[#D1FE17]/10 text-[#D1FE17]'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              {scene.dialogue && scene.videoModel !== 'veo-3.1' && (
                <span className="text-[10px] text-amber-400">Dialogue pesa Veo venum</span>
              )}
            </div>

            {/* Output area */}
            <div className="px-4 pb-3">
              {scene.videoUrl ? (
                <div className="space-y-2">
                  <video
                    src={scene.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full rounded-lg bg-black max-h-[420px]"
                  />
                  <div className="flex gap-2">
                    <a
                      href={scene.videoUrl}
                      download={`scene-${index + 1}.mp4`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm py-2.5 min-h-[44px] touch-manipulation"
                    >
                      <Download className="w-4 h-4" />
                      Save clip
                    </a>
                    <button
                      type="button"
                      disabled={anyRunning}
                      onClick={() => generateScene(scene.id)}
                      className="btn-secondary flex items-center justify-center gap-2 text-sm py-2.5 px-4 min-h-[44px] disabled:opacity-40 touch-manipulation"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Redo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {scene.frameUrl && (
                    <div className="relative">
                      <img
                        src={scene.frameUrl}
                        alt={`Scene ${index + 1} frame`}
                        className="w-full rounded-lg bg-black max-h-[320px] object-contain"
                      />
                      <span className="absolute top-2 left-2 text-[10px] bg-black/70 text-white rounded-full px-2 py-1">
                        Scene frame
                      </span>
                    </div>
                  )}

                  {isBusy ? (
                    <div className="flex items-center gap-2 text-sm text-gray-300 bg-black/40 border border-gray-800 rounded-lg px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-[#D1FE17]" />
                      {phase === 'frame'
                        ? 'Creating scene frame from your reference…'
                        : 'Animating the scene (1-3 min)…'}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={anyRunning}
                        onClick={() => generateScene(scene.id)}
                        className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm py-2.5 min-h-[44px] disabled:opacity-40 touch-manipulation"
                      >
                        <Clapperboard className="w-4 h-4" />
                        {scene.frameUrl ? 'Animate scene' : 'Generate scene'}
                      </button>
                      {scene.frameUrl && (
                        <button
                          type="button"
                          disabled={anyRunning}
                          onClick={() => generateScene(scene.id, { regenerateFrame: true })}
                          className="btn-secondary flex items-center justify-center gap-2 text-sm py-2.5 px-4 min-h-[44px] disabled:opacity-40 touch-manipulation"
                        >
                          <RefreshCw className="w-4 h-4" />
                          New frame
                        </button>
                      )}
                    </div>
                  )}

                  {error && phase === 'error' && (
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

      {/* Voice tips (guide steps 6-7) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-white mb-1.5">
          <Mic className="w-3.5 h-3.5 text-[#D1FE17]" />
          Voice upgrade venuma?
        </p>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Veo 3.1 dialogue audio generate pannum. Innum better voice venumna: clips download panni,{' '}
          <a
            href="https://cleanvoice.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#D1FE17] underline"
          >
            Cleanvoice.ai
          </a>{' '}
          la audio clean pannunga, aprom{' '}
          <a
            href="https://huggingface.co/spaces/Plachta/Seed-VC"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#D1FE17] underline"
          >
            Seed-VC
          </a>{' '}
          la character voice ku convert pannalam. Final assembly: CapCut / DaVinci.
        </p>
      </div>

      <button
        type="button"
        onClick={() => goToStep(3)}
        className="btn-ghost w-full min-h-[44px] touch-manipulation"
      >
        ← Change reference photo
      </button>
    </div>
  );
}
