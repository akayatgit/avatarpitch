'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import PathDrawingCanvas, { PathDrawingCanvasHandle } from '@/components/tools/PathDrawingCanvas';
import DurationSelect, { clampVideoDuration } from '@/components/workflows/DurationSelect';
import SensitiveVideoFallback from '@/components/workflows/SensitiveVideoFallback';
import VideoModelSelect from '@/components/workflows/VideoModelSelect';
import VideoReferenceSelect, {
  type VideoReferenceSource,
} from '@/components/workflows/VideoReferenceSelect';
import { DRONE_SHOT_FORMAT, type DroneShotState } from '@/lib/droneShot';
import { toDisplayImageUrl } from '@/lib/imageDisplay';
import { DEFAULT_IMAGE_MODEL_ID } from '@/lib/tools/imageModels';
import {
  DEFAULT_VIDEO_MODEL_ID,
  getVideoModel,
  type VideoModelId,
} from '@/lib/tools/videoModels';

/** Realistic mode: the photo IS the world — no concepts, no stylization. */
const REALISTIC_SCENE_DESCRIPTION =
  'The real-world scene exactly as it appears in the reference photo — realistic, photographic, true to the actual location, lighting, and subjects. No stylization, no surreal changes.';

function buildGrokSkipPathPrompt(durationSec: number): string {
  return [
    `Animate this real photo into a ${durationSec}s cinematic vertical 9:16 FPV drone shot.`,
    'Photorealistic and true to life — keep the exact subjects, location, lighting, colors, and composition from the starting frame.',
    'Motion: smooth cinematic drone camera exploring the real scene with natural momentum.',
    'No red lines, arrows, UI overlays, watermarks, or on-screen text.',
  ].join('\n');
}

type Step = 'image' | 'draw' | 'prompt' | 'video';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'image', label: 'Photo' },
  { id: 'draw', label: 'Path' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'video', label: 'Video' },
];

/** Map legacy saved steps ('ideation'/'world') onto the simplified flow. */
function resolveInitialStep(state: DroneShotState | null): Step {
  if (!state) return 'image';
  if (state.step === 'draw' || state.step === 'prompt' || state.step === 'video') {
    return state.step;
  }
  return state.aerialImageUrl ? 'draw' : 'image';
}

export interface RecentDroneShotProject {
  id: string;
  title: string;
  createdAt: string;
  hasVideo: boolean;
}

interface Props {
  onBack?: () => void;
  initialProjectId?: string | null;
  initialState?: DroneShotState | null;
  recentProjects?: RecentDroneShotProject[];
}

export default function DroneTracingShotStudio({
  onBack,
  initialProjectId = null,
  initialState = null,
  recentProjects = [],
}: Props) {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState<Step>(resolveInitialStep(initialState));
  const [error, setError] = useState<string | null>(null);

  // ── Inspiration photo (used directly as the world still) ──
  const initialInspiration =
    initialState?.inspirationImageUrl ??
    initialState?.aerialImageUrl ??
    initialState?.ideation?.inspirationImageUrl ??
    null;
  const [rawUrl, setRawUrl] = useState(initialInspiration ?? '');
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(initialInspiration);
  const [resolving, setResolving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const resolveSeq = useRef(0);
  // Skip the resolve round-trip for URLs we already know are direct (restored / uploaded)
  const preResolvedRef = useRef<string | null>(initialInspiration);

  const [duration, setDuration] = useState(initialState?.duration ?? 12);
  const [resolution, setResolution] = useState<'720p' | '480p'>(
    initialState?.resolution ?? '720p'
  );
  const [videoModel, setVideoModel] = useState<VideoModelId>(
    initialState?.videoModel ?? DEFAULT_VIDEO_MODEL_ID
  );
  const [referenceSource, setReferenceSource] = useState<VideoReferenceSource>(
    initialState?.referenceSource ?? 'path'
  );
  const [sensitiveSuggestedModel, setSensitiveSuggestedModel] = useState<VideoModelId | null>(null);

  const [aerialImageUrl, setAerialImageUrl] = useState<string | null>(
    initialState?.aerialImageUrl ?? null
  );
  const [hasPath, setHasPath] = useState(false);
  const canvasRef = useRef<PathDrawingCanvasHandle>(null);

  const [annotatedImage, setAnnotatedImage] = useState<string | null>(
    initialState?.annotatedImage ?? null
  );
  const [prompt, setPrompt] = useState(initialState?.prompt ?? '');
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [pathAnalysis, setPathAnalysis] = useState<string | null>(
    initialState?.pathAnalysis ?? null
  );

  const [videoUrl, setVideoUrl] = useState<string | null>(initialState?.videoUrl ?? null);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  // ── Resolve pin.it / pinterest URLs into direct image URLs ──
  useEffect(() => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      setResolvedUrl(null);
      setThumbError(null);
      setResolving(false);
      return;
    }
    if (trimmed === preResolvedRef.current) return;

    let cancelled = false;
    const seq = ++resolveSeq.current;
    const timer = setTimeout(async () => {
      setResolving(true);
      setThumbError(null);
      try {
        const response = await fetch('/api/resolve-inspiration-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled || seq !== resolveSeq.current) return;
        if (!response.ok || data.error) {
          setResolvedUrl(null);
          setThumbError(data.error || 'Could not load that image URL');
          return;
        }
        setResolvedUrl(typeof data.imageUrl === 'string' ? data.imageUrl : null);
      } catch {
        if (!cancelled && seq === resolveSeq.current) {
          setResolvedUrl(null);
          setThumbError('Could not resolve that URL');
        }
      } finally {
        if (!cancelled && seq === resolveSeq.current) setResolving(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rawUrl]);

  const handleUploadFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setThumbError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('images', file);
      const response = await fetch('/api/upload-image', { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error || typeof data.url !== 'string') {
        throw new Error(data.error || 'Failed to upload image');
      }
      // Storage URL is already direct — no resolve round-trip needed
      preResolvedRef.current = data.url;
      setRawUrl(data.url);
      setResolvedUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  // ── Autosave to content_creation_requests (mirrors StudioWizard) ──
  const persistableState = useMemo<DroneShotState>(
    () => ({
      format: DRONE_SHOT_FORMAT,
      step,
      ideation: initialState?.ideation ?? null,
      inspirationImageUrl: resolvedUrl,
      duration,
      resolution,
      imageModel: initialState?.imageModel ?? DEFAULT_IMAGE_MODEL_ID,
      videoModel,
      referenceSource,
      aerialImageUrl,
      annotatedImage,
      prompt,
      pathAnalysis,
      videoUrl,
    }),
    [
      step,
      initialState,
      resolvedUrl,
      duration,
      resolution,
      videoModel,
      referenceSource,
      aerialImageUrl,
      annotatedImage,
      prompt,
      pathAnalysis,
      videoUrl,
    ]
  );

  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const stateRef = useRef(persistableState);
  stateRef.current = persistableState;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  const persistNow = useCallback(async () => {
    const currentState = stateRef.current;
    // Nothing worth saving until the photo is locked in as the world still
    if (!currentState.aerialImageUrl) return;
    setSaving(true);
    try {
      const response = await fetch('/api/drone-shot/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectIdRef.current, state: currentState }),
      });
      const data = await response.json();
      if (response.ok && data?.projectId && !projectIdRef.current) {
        setProjectId(data.projectId);
        // Keep the URL shareable / refresh-safe without a navigation
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', `/app/drone-shot?projectId=${data.projectId}`);
        }
      }
      // The save route re-hosts large data-URL path images in storage — adopt the durable URL
      if (
        response.ok &&
        typeof data?.state?.annotatedImage === 'string' &&
        stateRef.current.annotatedImage?.startsWith('data:')
      ) {
        setAnnotatedImage(data.state.annotatedImage);
      }
    } catch (error) {
      console.error('Autosave failed:', error);
    } finally {
      setSaving(false);
    }
  }, []);

  // Debounced autosave whenever state changes (skips first render / hydration)
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      void persistNow();
    }, 1200);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [persistableState, persistNow]);

  const handleUsePhoto = () => {
    if (!resolvedUrl) {
      setError('Paste a Pinterest / image URL or upload a photo first');
      return;
    }
    setError(null);
    setAerialImageUrl(resolvedUrl);
    setHasPath(false);
    setStep('draw');
  };

  const handleVideoModelChange = (id: VideoModelId) => {
    setVideoModel(id);
    setSensitiveSuggestedModel(null);
    if (id === 'grok-imagine-1.5') setReferenceSource('original');
    else if (annotatedImage) setReferenceSource('path');
  };

  const handleSkipPathForGrok = () => {
    if (!aerialImageUrl) {
      setError('Pick a photo before skipping the path');
      return;
    }
    setAnnotatedImage(null);
    setPathAnalysis(null);
    setReferenceSource('original');
    setVideoModel('grok-imagine-1.5');
    setPrompt(buildGrokSkipPathPrompt(duration));
    setError(null);
    setStep('prompt');
  };

  const handleConfirmPath = async () => {
    if (!canvasRef.current) return;
    let exported: string;
    try {
      exported = canvasRef.current.exportAnnotatedImage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export the drawn path');
      return;
    }

    setAnnotatedImage(exported);
    setReferenceSource(videoModel === 'grok-imagine-1.5' ? 'original' : 'path');
    setError(null);
    setGeneratingPrompt(true);
    setPathAnalysis(null);
    setStep('prompt');
    try {
      const response = await fetch('/api/assemble-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: 'drone-tracing-shot',
          inputs: {
            locationDescription: REALISTIC_SCENE_DESCRIPTION,
            duration,
            annotatedImage: exported,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || 'Failed to assemble the drone prompt');
      setPrompt(typeof data.prompt === 'string' ? data.prompt : '');
      if (typeof data.duration === 'number') setDuration(clampVideoDuration(data.duration, duration));
      setPathAnalysis(typeof data.pathAnalysis === 'string' ? data.pathAnalysis : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assemble the drone prompt');
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const resolveVideoReference = (source: VideoReferenceSource): string | null => {
    if (source === 'path' && annotatedImage) return annotatedImage;
    return aerialImageUrl;
  };

  const handleGenerateVideo = async (modelOverride?: VideoModelId) => {
    if (!prompt.trim()) { setError('A prompt is required'); return; }
    const modelToUse = modelOverride ?? videoModel;
    let source = referenceSource;
    if (modelOverride) {
      setVideoModel(modelOverride);
      setSensitiveSuggestedModel(null);
      if (modelOverride === 'grok-imagine-1.5') { source = 'original'; setReferenceSource('original'); }
    }
    if (modelToUse === 'seedance-2' && !annotatedImage) {
      setError('Seedance needs a drawn path — draw one, or switch to Grok Imagine');
      return;
    }
    const referenceImages =
      modelToUse === 'seedance-2'
        ? [annotatedImage!]
        : [resolveVideoReference(source)].filter((u): u is string => Boolean(u));
    if (referenceImages.length === 0) { setError('A reference image is required'); return; }
    setError(null);
    setSensitiveSuggestedModel(null);
    setGeneratingVideo(true);
    setVideoUrl(null);
    setStep('video');
    try {
      const response = await fetch('/api/workflows/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), referenceImages, duration, resolution, model: modelToUse }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        if (data.code === 'SENSITIVE_CONTENT') {
          setSensitiveSuggestedModel((data.suggestedModel as VideoModelId) || 'grok-imagine-1.5');
          setReferenceSource('original');
        }
        throw new Error(data.error || 'Failed to generate the drone shot');
      }
      setVideoUrl(data.videoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate the drone shot');
      setStep('prompt');
    } finally {
      setGeneratingVideo(false);
    }
  };

  const handleDownloadVideo = async () => {
    if (!videoUrl) return;
    setDownloading(true);
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drone-tracing-shot-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download the video');
    } finally {
      setDownloading(false);
    }
  };

  const handleStartNew = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setProjectId(null);
    setStep('image'); setError(null);
    setRawUrl(''); setResolvedUrl(null); setThumbError(null);
    preResolvedRef.current = null;
    setAerialImageUrl(null); setHasPath(false); setAnnotatedImage(null);
    setPrompt(''); setDuration(12); setPathAnalysis(null); setVideoUrl(null);
    setVideoModel(DEFAULT_VIDEO_MODEL_ID); setReferenceSource('path');
    setSensitiveSuggestedModel(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/app/drone-shot');
    }
  };

  const isFreshProject = !projectId && !aerialImageUrl;

  return (
    <div className="space-y-3 max-w-4xl">

      {/* ── Header: project state ── */}
      {(projectId || saving) && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-gray-500">
            Drone shot
            {saving && <span className="ml-2 text-gray-600">Saving…</span>}
          </p>
          {projectId && (
            <button
              type="button"
              onClick={handleStartNew}
              className="flex items-center gap-1 text-xs text-gray-300 border border-gray-700 rounded-lg px-3 py-2 hover:bg-gray-900 flex-shrink-0 touch-manipulation"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          )}
        </div>
      )}

      {/* ── iOS-style step dots ── */}
      <div className="flex items-start gap-0 px-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-start flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`rounded-full transition-all duration-300 ${
                  i < stepIndex
                    ? 'w-2.5 h-2.5 bg-[#D1FE17]/60 mt-0.5'
                    : i === stepIndex
                    ? 'w-3.5 h-3.5 bg-[#D1FE17] shadow-[0_0_10px_rgba(209,254,23,0.55)]'
                    : 'w-2 h-2 border border-gray-700 mt-0.5'
                }`}
              />
              <span
                className={`text-[9px] mt-1 font-medium whitespace-nowrap transition-colors ${
                  i === stepIndex ? 'text-[#D1FE17]' : i < stepIndex ? 'text-gray-600' : 'text-gray-700'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px flex-1 mt-[6px] transition-colors ${
                  i < stepIndex ? 'bg-[#D1FE17]/25' : 'bg-gray-800'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-950/60 px-3 py-2.5 rounded-xl border border-red-900">
          {error}
        </div>
      )}

      {/* ── Photo: the Pinterest image IS the world still ── */}
      {step === 'image' && (
        <>
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white tracking-tight">Real photo</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Paste a Pinterest link or upload a photo — the drone flies through this exact scene.
                </p>
              </div>
              {onBack && (
                <button type="button" onClick={onBack} className="text-xs text-gray-500 hover:text-white flex-shrink-0">
                  All templates
                </button>
              )}
            </div>

            {/* Pinterest / image URL + photo upload */}
            <div className="flex gap-2">
              <input
                id="inspo-url"
                type="url"
                value={rawUrl}
                onChange={(e) => setRawUrl(e.target.value)}
                className="input-field text-sm flex-1"
                placeholder="Paste a pin.it / pinterest.com URL, or upload a photo…"
              />
              <label
                className={`flex items-center px-4 rounded-xl border border-gray-800 text-xs font-medium whitespace-nowrap transition-all touch-manipulation ${
                  uploading
                    ? 'text-gray-600 cursor-wait'
                    : 'text-gray-300 cursor-pointer hover:border-gray-600 hover:text-white active:scale-95'
                }`}
              >
                {uploading ? 'Uploading…' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    void handleUploadFile(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {/* Photo preview — full width */}
            {(resolving || resolvedUrl || thumbError) && (
              <div className="w-full rounded-2xl overflow-hidden bg-gray-950 border border-gray-800">
                {resolving ? (
                  <div className="h-48 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-[#D1FE17] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : thumbError ? (
                  <div className="h-20 flex items-center justify-center px-4">
                    <p className="text-xs text-red-400 text-center">{thumbError}</p>
                  </div>
                ) : resolvedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={toDisplayImageUrl(resolvedUrl)}
                    alt="Inspiration photo"
                    className="w-full max-h-72 object-contain"
                    onError={() => setThumbError('Thumbnail failed to load — try a direct pinimg.com URL')}
                  />
                ) : null}
              </div>
            )}

            {/* Settings row */}
            <div className="grid grid-cols-2 gap-3">
              <DurationSelect value={duration} onChange={setDuration} />
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1.5">Resolution</p>
                <div className="flex gap-2">
                  {(['720p', '480p'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setResolution(r)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border-2 transition-all ${
                        resolution === r
                          ? 'border-[#D1FE17] bg-[#D1FE17]/10 text-[#D1FE17]'
                          : 'border-gray-800 text-gray-500'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleUsePhoto}
              disabled={resolving || uploading || !resolvedUrl}
              className="w-full btn-primary disabled:opacity-40 text-sm py-3"
            >
              Draw flight path →
            </button>
          </div>

          {/* Recent drone shots (only on a fresh start) */}
          {isFreshProject && recentProjects.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Continue where you left off</h2>
              <div className="space-y-2">
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/app/drone-shot?projectId=${project.id}`}
                    className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-600 transition-colors touch-manipulation"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {project.title || 'Drone shot'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {project.hasVideo ? 'Video ready' : 'In progress'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-3">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Draw path ── */}
      {step === 'draw' && aerialImageUrl && (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-white">Draw the flight path</h2>
          <div className="max-w-sm mx-auto w-full">
            <PathDrawingCanvas
              ref={canvasRef}
              imageUrl={toDisplayImageUrl(aerialImageUrl)}
              onPathChange={setHasPath}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => canvasRef.current?.undo()}
              className="px-3 py-2 text-xs text-white border border-gray-800 rounded-xl hover:border-gray-600 transition-all"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.clear()}
              className="px-3 py-2 text-xs text-white border border-gray-800 rounded-xl hover:border-gray-600 transition-all"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setStep('image')}
              className="px-3 py-2 text-xs text-gray-500 hover:text-white"
            >
              Change photo
            </button>
          </div>
          <button
            type="button"
            onClick={handleConfirmPath}
            disabled={!hasPath}
            className="w-full btn-primary disabled:opacity-40 text-sm py-3"
          >
            {hasPath ? 'Use this path →' : 'Draw a path to continue'}
          </button>
          <button
            type="button"
            onClick={handleSkipPathForGrok}
            className="w-full px-4 py-2.5 text-xs text-gray-400 border border-gray-800 rounded-xl hover:border-gray-600 transition-all"
          >
            Skip — Grok Imagine (clean image)
          </button>
        </div>
      )}

      {/* ── Prompt review ── */}
      {step === 'prompt' && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-white">Flight prompt</h2>

          {pathAnalysis && (
            <div className="bg-gray-950 border border-gray-800 rounded-xl p-3">
              <p className="text-[10px] font-medium text-[#D1FE17] mb-1">Traced path</p>
              <p className="text-[10px] text-gray-500">{pathAnalysis}</p>
            </div>
          )}

          {generatingPrompt ? (
            <div className="min-h-[200px] flex items-center justify-center bg-gray-950 rounded-xl border border-gray-800">
              <div className="w-7 h-7 border-[3px] border-[#D1FE17] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full min-h-[260px] bg-gray-950 text-white text-xs rounded-xl border border-gray-800 p-3 font-mono focus:border-[#D1FE17] focus:outline-none resize-none"
            />
          )}

          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1.5">Video model</p>
              <VideoModelSelect value={videoModel} onChange={handleVideoModelChange} disabled={generatingVideo} />
            </div>
            <VideoReferenceSelect
              value={referenceSource}
              onChange={setReferenceSource}
              originalImageUrl={aerialImageUrl}
              pathImageUrl={annotatedImage}
              disabled={generatingVideo}
              showGrokHint={videoModel === 'grok-imagine-1.5'}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-gray-600">
            <button type="button" onClick={() => setStep(aerialImageUrl ? 'draw' : 'image')} className="hover:text-white">
              Back
            </button>
            <span>{duration}s · {resolution} · {referenceSource === 'path' ? 'path ref' : 'original'}</span>
          </div>

          {sensitiveSuggestedModel && (
            <SensitiveVideoFallback
              suggestedModel={sensitiveSuggestedModel}
              disabled={generatingVideo}
              onSwitchAndRetry={(id) => handleGenerateVideo(id)}
            />
          )}

          <button
            type="button"
            onClick={() => handleGenerateVideo()}
            disabled={generatingPrompt || generatingVideo || !prompt.trim()}
            className="w-full btn-primary disabled:opacity-40 text-sm py-3"
          >
            {generatingVideo
              ? `Generating with ${getVideoModel(videoModel).name}…`
              : `Generate · ${getVideoModel(videoModel).name}`}
          </button>
        </div>
      )}

      {/* ── Video result ── */}
      {step === 'video' && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-white">Your FPV drone shot</h2>
          {generatingVideo || !videoUrl ? (
            <div className="max-w-sm mx-auto aspect-[9/16] bg-gray-950 rounded-2xl border border-gray-800 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-[3px] border-[#D1FE17] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-500">Rendering your shot…</p>
            </div>
          ) : (
            <>
              <div className="max-w-sm mx-auto">
                <video src={videoUrl} className="w-full rounded-2xl" controls autoPlay loop />
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={handleDownloadVideo}
                  disabled={downloading}
                  className="px-5 py-2.5 bg-[#D1FE17] text-black text-sm font-semibold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
                >
                  {downloading ? 'Downloading…' : 'Download MP4'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('prompt')}
                  className="px-4 py-2.5 text-xs text-white border border-gray-800 rounded-xl hover:border-gray-600 transition-all"
                >
                  Edit prompt
                </button>
                <button
                  type="button"
                  onClick={handleStartNew}
                  className="px-4 py-2.5 text-xs text-gray-500 hover:text-white"
                >
                  New shot
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
