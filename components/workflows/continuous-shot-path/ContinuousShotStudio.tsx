'use client';

import { useRef, useState } from 'react';
import PathDrawingCanvas, { PathDrawingCanvasHandle } from '@/components/tools/PathDrawingCanvas';
import DurationSelect, { clampVideoDuration } from '@/components/workflows/DurationSelect';
import SensitiveVideoFallback from '@/components/workflows/SensitiveVideoFallback';
import SurrealIdeationStep, {
  type SurrealIdeationResult,
} from '@/components/workflows/SurrealIdeationStep';
import VideoModelSelect from '@/components/workflows/VideoModelSelect';
import VideoReferenceSelect, {
  type VideoReferenceSource,
} from '@/components/workflows/VideoReferenceSelect';
import { toDisplayImageUrl } from '@/lib/imageDisplay';
import { applyInspirationImageLocks } from '@/lib/styles/surrealTech';
import { fileToDataUrl } from '@/lib/tools/localImage';
import {
  DEFAULT_VIDEO_MODEL_ID,
  getVideoModel,
  type VideoModelId,
} from '@/lib/tools/videoModels';
import { CONTINUOUS_SHOT_PATH } from '@/lib/workflows/definitions';

function buildGrokSkipPathPrompt(
  sceneDescription: string,
  objectDescription: string,
  durationSec: number,
  ideation: SurrealIdeationResult | null
): string {
  return [
    `Animate this still into a ${durationSec}s cinematic continuous vertical 9:16 take.`,
    ideation ? `Teaching topic: ${ideation.topic}` : '',
    `Scene: ${sceneDescription.trim()}`,
    objectDescription.trim()
      ? `Object interaction: weave in ${objectDescription.trim()} naturally.`
      : '',
    ideation?.suggestion.motionHint
      ? `Motion: ${ideation.suggestion.motionHint}`
      : 'Motion: smooth continuous camera move with light handheld energy.',
    'Keep subjects and composition from the starting frame.',
    'No red lines, arrows, UI overlays, watermarks, or on-screen text.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Workflow: Style & Idea → scene + object → draw path → assemble → video model
 */

type Step = 'ideation' | 'scene' | 'draw' | 'prompt' | 'video';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'ideation', label: 'Style & Idea' },
  { id: 'scene', label: 'Scene & Object' },
  { id: 'draw', label: 'Draw Path' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'video', label: 'Video' },
];

interface Props {
  onBack?: () => void;
}

export default function ContinuousShotStudio({ onBack }: Props) {
  const [step, setStep] = useState<Step>('ideation');
  const [error, setError] = useState<string | null>(null);
  const [ideation, setIdeation] = useState<SurrealIdeationResult | null>(null);

  const [sceneDescription, setSceneDescription] = useState('');
  const [objectDescription, setObjectDescription] = useState('');
  const [baseSource, setBaseSource] = useState<'upload' | 'generate'>('generate');
  const [baseImageUrl, setBaseImageUrl] = useState<string | null>(null);
  const [objectImageUrl, setObjectImageUrl] = useState<string | null>(null);
  const [resolution, setResolution] = useState<'720p' | '480p'>('720p');
  const [videoModel, setVideoModel] = useState<VideoModelId>(DEFAULT_VIDEO_MODEL_ID);
  const [referenceSource, setReferenceSource] = useState<VideoReferenceSource>('path');
  const [sensitiveSuggestedModel, setSensitiveSuggestedModel] = useState<VideoModelId | null>(
    null
  );
  const [generatingImage, setGeneratingImage] = useState(false);

  const [hasPath, setHasPath] = useState(false);
  const canvasRef = useRef<PathDrawingCanvasHandle>(null);

  const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(CONTINUOUS_SHOT_PATH.defaultDuration);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [pathAnalysis, setPathAnalysis] = useState<string | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const handleIdeationComplete = (result: SurrealIdeationResult) => {
    setIdeation(result);
    setSceneDescription(
      `${result.suggestion.title}. ${result.suggestion.concept}\n\n${result.suggestion.imagePrompt}`
    );
    setBaseImageUrl(result.finalImageUrl);
    setBaseSource('generate');
    setError(null);
    setStep('scene');
  };

  const handleUploadBase = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setBaseImageUrl(dataUrl);
      setBaseSource('upload');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read base image');
    }
  };

  const handleUploadObject = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setObjectImageUrl(dataUrl);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read object image');
    }
  };

  const handleGenerateBase = async () => {
    const trimmed = sceneDescription.trim();
    if (!trimmed) {
      setError('Describe the scene first');
      return;
    }
    if (!ideation) {
      setError('Complete style & idea first');
      return;
    }
    setError(null);
    setGeneratingImage(true);
    try {
      const locked = applyInspirationImageLocks(
        ideation.suggestion.imagePrompt || trimmed,
        ideation.suggestion.scale
      );
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenePrompt: `Locked cinematic first-frame still for a continuous one-take: ${locked}`,
          referenceImageUrls: [
            ideation.inspirationImageUrl,
            ideation.draftImageUrl || ideation.finalImageUrl,
          ].filter(Boolean),
          numImages: 1,
          size: '2K',
          mode: 'none',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate the scene still');
      }
      const url: string | undefined = Array.isArray(data.images) ? data.images[0] : undefined;
      if (!url) throw new Error('Image API returned no usable image');
      setBaseImageUrl(url);
      setBaseSource('generate');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate the scene still');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleContinueToDraw = () => {
    if (!sceneDescription.trim()) {
      setError('Scene description is required');
      return;
    }
    if (!baseImageUrl) {
      setError('Upload or generate a base scene image first');
      return;
    }
    if (!objectImageUrl) {
      setError('Upload an object reference image (second reference)');
      return;
    }
    setError(null);
    setHasPath(false);
    setStep('draw');
  };

  const handleVideoModelChange = (id: VideoModelId) => {
    setVideoModel(id);
    setSensitiveSuggestedModel(null);
    if (id === 'grok-imagine-1.5') {
      setReferenceSource('original');
    } else if (annotatedImage) {
      setReferenceSource('path');
    }
  };

  const handleSkipPathForGrok = () => {
    if (!baseImageUrl) {
      setError('Base scene image is required before skipping the path');
      return;
    }
    if (!objectImageUrl) {
      setError('Object reference is still required');
      return;
    }
    setAnnotatedImage(null);
    setPathAnalysis(null);
    setReferenceSource('original');
    setVideoModel('grok-imagine-1.5');
    setPrompt(
      buildGrokSkipPathPrompt(sceneDescription, objectDescription, duration, ideation)
    );
    setError(null);
    setStep('prompt');
  };

  const handleConfirmPath = async () => {
    if (!canvasRef.current || !objectImageUrl) return;
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
          workflowId: 'continuous-shot-path',
          inputs: {
            sceneDescription: sceneDescription.trim(),
            objectDescription: objectDescription.trim() || undefined,
            annotatedImage: exported,
            objectImage: objectImageUrl,
            duration,
            inspirationImageUrl: ideation?.inspirationImageUrl,
            inspirationRead: ideation?.inspirationRead ?? undefined,
            topic: ideation?.topic,
            motionHint: ideation?.suggestion.motionHint,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to assemble the continuous-shot prompt');
      }
      setPrompt(typeof data.prompt === 'string' ? data.prompt : '');
      if (typeof data.duration === 'number') {
        setDuration(clampVideoDuration(data.duration, duration));
      }
      setPathAnalysis(typeof data.pathAnalysis === 'string' ? data.pathAnalysis : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assemble the prompt');
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const resolveVideoReference = (source: VideoReferenceSource): string | null => {
    if (source === 'path' && annotatedImage) return annotatedImage;
    return baseImageUrl;
  };

  const handleGenerateVideo = async (modelOverride?: VideoModelId) => {
    if (!objectImageUrl || !prompt.trim()) {
      setError('Object image and prompt are required');
      return;
    }
    const modelToUse = modelOverride ?? videoModel;
    let source = referenceSource;
    if (modelOverride) {
      setVideoModel(modelOverride);
      setSensitiveSuggestedModel(null);
      if (modelOverride === 'grok-imagine-1.5') {
        source = 'original';
        setReferenceSource('original');
      }
    }
    const firstFrame = resolveVideoReference(source);
    if (!firstFrame) {
      setError('A reference image is required');
      return;
    }
    if (modelToUse === 'seedance-2' && !annotatedImage) {
      setError('Seedance needs a drawn path — draw one, or switch to Grok Imagine');
      return;
    }
    setError(null);
    setSensitiveSuggestedModel(null);
    setGeneratingVideo(true);
    setVideoUrl(null);
    setStep('video');
    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          // Grok uses [0] as first frame; Seedance uses both refs
          referenceImages: [firstFrame, objectImageUrl],
          duration,
          resolution,
          model: modelToUse,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        if (data.code === 'SENSITIVE_CONTENT') {
          setSensitiveSuggestedModel(
            (data.suggestedModel as VideoModelId) || 'grok-imagine-1.5'
          );
          setReferenceSource('original');
        }
        throw new Error(data.error || 'Failed to generate the continuous shot');
      }
      setVideoUrl(data.videoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate the continuous shot');
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
      a.download = `continuous-shot-${Date.now()}.mp4`;
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
    setStep('ideation');
    setIdeation(null);
    setError(null);
    setSceneDescription('');
    setObjectDescription('');
    setBaseImageUrl(null);
    setObjectImageUrl(null);
    setHasPath(false);
    setAnnotatedImage(null);
    setPrompt('');
    setDuration(12);
    setPathAnalysis(null);
    setVideoUrl(null);
    setVideoModel(DEFAULT_VIDEO_MODEL_ID);
    setReferenceSource('path');
    setSensitiveSuggestedModel(null);
  };

  return (
    <div className="space-y-4 max-w-4xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                    i === stepIndex
                      ? 'bg-[#D1FE17] text-black'
                      : i < stepIndex
                        ? 'bg-gray-800 text-[#D1FE17]'
                        : 'bg-gray-900 text-gray-500'
                  }`}
                >
                  <span>{i + 1}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="w-4 h-px bg-gray-700" />}
              </div>
            ))}
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-gray-400 hover:text-white shrink-0"
            >
              All templates
            </button>
          )}
        </div>

        {error && step !== 'ideation' && (
          <div className="text-sm text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-800">
            {error}
          </div>
        )}

        {step === 'ideation' && (
          <SurrealIdeationStep
            onComplete={handleIdeationComplete}
            onBack={onBack}
            stillMode="scene"
          />
        )}

        {step === 'scene' && (
          <div className="card space-y-5">
            {ideation && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <p className="text-xs text-[#D1FE17] uppercase mb-1">
                  {ideation.suggestion.scale} · {ideation.topic}
                </p>
                <p className="text-sm text-white font-medium">{ideation.suggestion.title}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Scene description *</label>
              <textarea
                value={sceneDescription}
                onChange={(e) => setSceneDescription(e.target.value)}
                className="input-field min-h-[120px]"
                placeholder="Minimalist surreal — one hero, one twist, simple backdrop..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Base scene image *</label>
              <div className="flex gap-2 mb-3">
                {(['generate', 'upload'] as const).map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setBaseSource(src)}
                    className={`px-3 py-2 text-xs rounded-lg border-2 ${
                      baseSource === src
                        ? 'border-[#D1FE17] text-[#D1FE17] bg-[#D1FE17]/10'
                        : 'border-gray-700 text-gray-400'
                    }`}
                  >
                    {src === 'generate' ? 'AI generate' : 'Upload'}
                  </button>
                ))}
              </div>
              {baseSource === 'generate' ? (
                <button
                  type="button"
                  onClick={handleGenerateBase}
                  disabled={generatingImage || !sceneDescription.trim()}
                  className="w-full btn-primary disabled:opacity-50 min-h-[44px] mb-3"
                >
                  {generatingImage
                    ? 'Generating scene still...'
                    : baseImageUrl
                      ? 'Regenerate scene still'
                      : 'Generate Scene Still'}
                </button>
              ) : (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleUploadBase(e.target.files?.[0] ?? null)}
                  className="text-xs text-gray-300 mb-3"
                />
              )}
              {baseImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toDisplayImageUrl(baseImageUrl)}
                  alt="Base scene"
                  className="w-40 rounded-lg border border-gray-800"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Object reference image * ([Image2])
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUploadObject(e.target.files?.[0] ?? null)}
                className="text-xs text-gray-300 mb-2"
              />
              <input
                type="text"
                value={objectDescription}
                onChange={(e) => setObjectDescription(e.target.value)}
                className="input-field"
                placeholder="Optional tweak — e.g. nuclear-style bomb, meteor, glowing orb"
              />
              {objectImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={objectImageUrl}
                  alt="Object reference"
                  className="mt-2 w-28 rounded-lg border border-gray-800"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <DurationSelect value={duration} onChange={setDuration} />
              <div>
                <label className="block text-sm font-medium text-white mb-2">Resolution</label>
                <div className="flex gap-2">
                  {(['720p', '480p'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setResolution(r)}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 ${
                        resolution === r
                          ? 'border-[#D1FE17] bg-[#D1FE17]/20 text-[#D1FE17]'
                          : 'border-gray-700 text-gray-400'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <VideoModelSelect value={videoModel} onChange={setVideoModel} />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('ideation')}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleContinueToDraw}
                disabled={!baseImageUrl || !objectImageUrl || !sceneDescription.trim()}
                className="flex-1 btn-primary disabled:opacity-50 min-h-[44px]"
              >
                Continue to Draw Path
              </button>
              <button
                type="button"
                onClick={handleSkipPathForGrok}
                disabled={!baseImageUrl || !objectImageUrl || !sceneDescription.trim()}
                className="w-full sm:w-auto px-4 py-3 text-xs text-white border border-gray-700 rounded-lg disabled:opacity-50"
              >
                Skip path → Grok (clean image)
              </button>
            </div>
          </div>
        )}

        {step === 'draw' && baseImageUrl && (
          <div className="card space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Draw the camera / subject path</h2>
              <p className="text-sm text-gray-400 mt-1">
                Optional for Grok Imagine (it often keeps the red line). Required for Seedance.
              </p>
            </div>
            <div className="max-w-sm mx-auto w-full">
              <PathDrawingCanvas
                ref={canvasRef}
                imageUrl={toDisplayImageUrl(baseImageUrl)}
                onPathChange={setHasPath}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => canvasRef.current?.undo()}
                className="px-3 py-1.5 text-xs text-white border border-gray-700 rounded-lg"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => canvasRef.current?.clear()}
                className="px-3 py-1.5 text-xs text-white border border-gray-700 rounded-lg"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setStep('scene')}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Back
              </button>
            </div>
            <button
              type="button"
              onClick={handleConfirmPath}
              disabled={!hasPath}
              className="w-full btn-primary disabled:opacity-50 min-h-[44px]"
            >
              {hasPath ? 'Use This Path' : 'Draw a path to continue'}
            </button>
            <button
              type="button"
              onClick={handleSkipPathForGrok}
              className="w-full px-4 py-3 text-xs text-white border border-gray-700 rounded-lg"
            >
              Skip path — use clean image with Grok Imagine
            </button>
          </div>
        )}

        {step === 'prompt' && (
          <div className="card space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Review continuous Master Prompt</h2>
              <p className="text-sm text-gray-400 mt-1">
                Beats, framing rules, object trajectory, effects inventory — editable before video.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1 space-y-3">
                {objectImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={objectImageUrl}
                    alt="Object"
                    className="w-full max-w-[120px] rounded-lg border border-gray-800"
                  />
                )}
                <p className="text-[11px] text-gray-400">
                  {annotatedImage
                    ? 'Path available · object [Image2] for Seedance'
                    : 'Path skipped — clean still for Grok'}
                </p>
                {pathAnalysis && (
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                    <p className="text-[11px] font-medium text-[#D1FE17] mb-1">Traced path</p>
                    <p className="text-[11px] text-gray-400">{pathAnalysis}</p>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                {generatingPrompt ? (
                  <div className="min-h-[320px] flex items-center justify-center bg-gray-900 rounded-lg border border-gray-800">
                    <div className="text-center">
                      <div className="w-8 h-8 border-4 border-[#D1FE17] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-xs text-gray-400">Assembling continuous Master Prompt...</p>
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full min-h-[420px] bg-gray-900 text-white text-xs rounded-lg border border-gray-700 p-3 font-mono"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <VideoModelSelect
                value={videoModel}
                onChange={handleVideoModelChange}
                disabled={generatingVideo}
              />
              <VideoReferenceSelect
                value={referenceSource}
                onChange={setReferenceSource}
                originalImageUrl={baseImageUrl}
                pathImageUrl={annotatedImage}
                disabled={generatingVideo}
                showGrokHint={videoModel === 'grok-imagine-1.5'}
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(baseImageUrl ? 'draw' : 'scene')}
                className="text-xs text-gray-400 hover:text-white"
              >
                Back
              </button>
              <p className="text-xs text-gray-400">
                {getVideoModel(videoModel).name} · 9:16 · {duration}s · {resolution} ·{' '}
                {referenceSource === 'path' ? 'path ref' : 'original ref'}
              </p>
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
              className="w-full btn-primary disabled:opacity-50 min-h-[44px]"
            >
              {generatingVideo
                ? `Generating with ${getVideoModel(videoModel).name}...`
                : `Generate with ${getVideoModel(videoModel).name}`}
            </button>
          </div>
        )}

        {step === 'video' && (
          <div className="card space-y-4">
            <h2 className="text-base font-semibold text-white">Your continuous shot</h2>
            {generatingVideo || !videoUrl ? (
              <div className="max-w-sm mx-auto w-full aspect-[9/16] bg-gray-900 rounded-lg border border-gray-800 flex items-center justify-center">
                <div className="text-center px-4">
                  <div className="w-10 h-10 border-4 border-[#D1FE17] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm text-white font-medium">Rendering continuous take...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="max-w-sm mx-auto w-full">
                  <video src={videoUrl} className="w-full rounded-lg" controls autoPlay loop />
                </div>
                <div className="flex justify-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleDownloadVideo}
                    disabled={downloading}
                    className="px-4 py-2 bg-[#D1FE17] text-black font-medium rounded-lg disabled:opacity-50"
                  >
                    {downloading ? 'Downloading...' : 'Download MP4'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('prompt')}
                    className="px-4 py-2 text-sm text-white border border-gray-700 rounded-lg"
                  >
                    Edit Prompt & Retry
                  </button>
                  <button
                    type="button"
                    onClick={handleStartNew}
                    className="px-4 py-2 text-sm text-gray-400"
                  >
                    New Shot
                  </button>
                </div>
              </>
            )}
          </div>
        )}
    </div>
  );
}
