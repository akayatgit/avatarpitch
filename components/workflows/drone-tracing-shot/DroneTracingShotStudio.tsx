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
import {
  DEFAULT_VIDEO_MODEL_ID,
  getVideoModel,
  type VideoModelId,
} from '@/lib/tools/videoModels';
function buildGrokSkipPathPrompt(ideation: SurrealIdeationResult, durationSec: number): string {
  return [
    `Animate this still into a ${durationSec}s cinematic vertical 9:16 shot.`,
    `Teaching topic: ${ideation.topic}`,
    `Concept: ${ideation.suggestion.title}. ${ideation.suggestion.concept}`,
    `Motion: ${ideation.suggestion.motionHint || 'Smooth cinematic camera exploring the scene with light handheld energy.'}`,
    'Keep the exact subjects, pose, and composition from the starting frame.',
    'No red lines, arrows, UI overlays, watermarks, or on-screen text.',
  ].join('\n');
}

/**
 * Workflow: Style & Idea → aerial still → draw path → assemble → video model
 */

type Step = 'ideation' | 'world' | 'draw' | 'prompt' | 'video';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'ideation', label: 'Style & Idea' },
  { id: 'world', label: 'World Still' },
  { id: 'draw', label: 'Draw Path' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'video', label: 'Video' },
];

interface Props {
  onBack?: () => void;
}

export default function DroneTracingShotStudio({ onBack }: Props) {
  const [step, setStep] = useState<Step>('ideation');
  const [error, setError] = useState<string | null>(null);
  const [ideation, setIdeation] = useState<SurrealIdeationResult | null>(null);

  const [duration, setDuration] = useState(12);
  const [resolution, setResolution] = useState<'720p' | '480p'>('720p');
  const [videoModel, setVideoModel] = useState<VideoModelId>(DEFAULT_VIDEO_MODEL_ID);
  const [referenceSource, setReferenceSource] = useState<VideoReferenceSource>('path');
  const [sensitiveSuggestedModel, setSensitiveSuggestedModel] = useState<VideoModelId | null>(
    null
  );
  const [generatingImage, setGeneratingImage] = useState(false);

  const [aerialImageUrl, setAerialImageUrl] = useState<string | null>(null);
  const [hasPath, setHasPath] = useState(false);
  const canvasRef = useRef<PathDrawingCanvasHandle>(null);

  const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [pathAnalysis, setPathAnalysis] = useState<string | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const handleIdeationComplete = (result: SurrealIdeationResult) => {
    setIdeation(result);
    setAerialImageUrl(result.finalImageUrl);
    setHasPath(false);
    setError(null);
    setStep('world');
  };

  /** Optional re-refine from draft + new corrections (keeps inspiration weight). */
  const handleGenerateAerial = async () => {
    if (!ideation) return;
    setError(null);
    setGeneratingImage(true);
    try {
      const scenePrompt = applyInspirationImageLocks(
        ideation.suggestion.imagePrompt,
        ideation.suggestion.scale
      );
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenePrompt,
          referenceImageUrls: [
            ideation.inspirationImageUrl,
            ideation.draftImageUrl || ideation.finalImageUrl,
          ].filter(Boolean),
          numImages: 1,
          size: '2K',
          // Do not force aerial landscape suffix — preserves inspiration subjects
          mode: 'none',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate the world still');
      }
      const url: string | undefined = Array.isArray(data.images) ? data.images[0] : undefined;
      if (!url) throw new Error('Image API returned no usable image');
      setAerialImageUrl(url);
      setHasPath(false);
      setStep('draw');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate the world still');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleVideoModelChange = (id: VideoModelId) => {
    setVideoModel(id);
    setSensitiveSuggestedModel(null);
    // Grok keeps red lines — default to clean still
    if (id === 'grok-imagine-1.5') {
      setReferenceSource('original');
    } else if (annotatedImage) {
      setReferenceSource('path');
    }
  };

  const handleSkipPathForGrok = () => {
    if (!ideation || !aerialImageUrl) {
      setError('World still is required before skipping the path');
      return;
    }
    setAnnotatedImage(null);
    setPathAnalysis(null);
    setReferenceSource('original');
    setVideoModel('grok-imagine-1.5');
    setPrompt(buildGrokSkipPathPrompt(ideation, duration));
    setError(null);
    setStep('prompt');
  };

  const handleConfirmPath = async () => {
    if (!canvasRef.current || !ideation) return;
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
            locationDescription: `${ideation.suggestion.title}: ${ideation.suggestion.concept}`,
            duration,
            annotatedImage: exported,
            inspirationImageUrl: ideation.inspirationImageUrl,
            inspirationRead: ideation.inspirationRead ?? undefined,
            topic: ideation.topic,
            motionHint: ideation.suggestion.motionHint,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to assemble the drone prompt');
      }
      setPrompt(typeof data.prompt === 'string' ? data.prompt : '');
      if (typeof data.duration === 'number') {
        setDuration(clampVideoDuration(data.duration, duration));
      }
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
    if (!prompt.trim()) {
      setError('A prompt is required');
      return;
    }
    const modelToUse = modelOverride ?? videoModel;
    let source = referenceSource;
    if (modelOverride) {
      setVideoModel(modelOverride);
      setSensitiveSuggestedModel(null);
      // Sensitive fallback → Grok: always use clean still (no red line)
      if (modelOverride === 'grok-imagine-1.5') {
        source = 'original';
        setReferenceSource('original');
      }
    }
    if (modelToUse === 'seedance-2' && !annotatedImage) {
      setError('Seedance needs a drawn path — draw one, or switch to Grok Imagine');
      return;
    }
    // Seedance: ONE ref only — annotated still ([Image1] = scene + path choreography)
    // Grok: single first-frame from reference dropdown (prefer clean original)
    const referenceImages =
      modelToUse === 'seedance-2'
        ? [annotatedImage!]
        : [resolveVideoReference(source)].filter((u): u is string => Boolean(u));
    if (referenceImages.length === 0) {
      setError('A reference image is required');
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
          referenceImages,
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
    setStep('ideation');
    setIdeation(null);
    setError(null);
    setAerialImageUrl(null);
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

        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-800">
            {error}
          </div>
        )}

        {step === 'ideation' && (
          <SurrealIdeationStep
            onComplete={handleIdeationComplete}
            onBack={onBack}
            stillMode="aerial"
          />
        )}

        {step === 'world' && ideation && (
          <div className="card space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">{ideation.suggestion.title}</h2>
              <p className="text-sm text-gray-400 mt-1">{ideation.suggestion.concept}</p>
              <p className="text-xs text-[#D1FE17] mt-2 uppercase">
                {ideation.suggestion.scale} · explaining: {ideation.topic}
              </p>
            </div>
            {aerialImageUrl && (
              <div className="max-w-xs mx-auto aspect-[9/16] rounded-lg border border-gray-700 overflow-hidden bg-gray-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={toDisplayImageUrl(aerialImageUrl)}
                  alt="World still"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <DurationSelect value={duration} onChange={setDuration} />
              <div>
                <label className="block text-sm font-medium text-white mb-2">Video resolution</label>
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStep('ideation')}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleGenerateAerial}
                disabled={generatingImage}
                className="px-4 py-2 text-xs text-white border border-gray-700 rounded-lg disabled:opacity-50"
              >
                {generatingImage ? 'Regenerating...' : 'Regenerate still'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!aerialImageUrl) {
                    setError('High-quality still missing — go back and refine one');
                    return;
                  }
                  setHasPath(false);
                  setStep('draw');
                }}
                disabled={!aerialImageUrl}
                className="flex-1 btn-primary disabled:opacity-50 min-h-[44px]"
              >
                Continue to draw path
              </button>
              <button
                type="button"
                onClick={handleSkipPathForGrok}
                disabled={!aerialImageUrl}
                className="w-full sm:w-auto px-4 py-3 text-xs text-white border border-gray-700 rounded-lg disabled:opacity-50"
              >
                Skip path → Grok (clean image)
              </button>
            </div>
          </div>
        )}

        {step === 'draw' && aerialImageUrl && (
          <div className="card space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Draw the flight path</h2>
              <p className="text-sm text-gray-400 mt-1">
                Optional for Grok Imagine (it often keeps the red line). Required for Seedance.
              </p>
            </div>
            <div className="max-w-sm mx-auto w-full">
              <PathDrawingCanvas
                ref={canvasRef}
                imageUrl={toDisplayImageUrl(aerialImageUrl)}
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
                onClick={handleGenerateAerial}
                disabled={generatingImage}
                className="px-3 py-1.5 text-xs text-white border border-gray-700 rounded-lg disabled:opacity-50"
              >
                {generatingImage ? 'Regenerating...' : 'Regenerate Still'}
              </button>
              <button
                type="button"
                onClick={() => setStep('world')}
                className="px-3 py-1.5 text-xs text-gray-400"
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
              {hasPath ? 'Use This Flight Path' : 'Draw a path to continue'}
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
            <h2 className="text-base font-semibold text-white">Review the flight prompt</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1 space-y-3">
                {pathAnalysis && (
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                    <p className="text-[11px] font-medium text-[#D1FE17] mb-1">Traced path</p>
                    <p className="text-[11px] text-gray-400">{pathAnalysis}</p>
                  </div>
                )}
                {!annotatedImage && (
                  <p className="text-[11px] text-gray-500">
                    Path skipped — using the clean still for Grok.
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                {generatingPrompt ? (
                  <div className="min-h-[280px] flex items-center justify-center bg-gray-900 rounded-lg border border-gray-800">
                    <div className="w-8 h-8 border-4 border-[#D1FE17] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full min-h-[380px] bg-gray-900 text-white text-xs rounded-lg border border-gray-700 p-3 font-mono"
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
                originalImageUrl={aerialImageUrl}
                pathImageUrl={annotatedImage}
                disabled={generatingVideo}
                showGrokHint={videoModel === 'grok-imagine-1.5'}
              />
            </div>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(annotatedImage || aerialImageUrl ? 'draw' : 'world')}
                className="text-xs text-gray-400"
              >
                Back
              </button>
              <p className="text-xs text-gray-400">
                {duration}s · {resolution} · {getVideoModel(videoModel).name} ·{' '}
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
            <h2 className="text-base font-semibold text-white">Your surreal FPV shot</h2>
            {generatingVideo || !videoUrl ? (
              <div className="max-w-sm mx-auto aspect-[9/16] bg-gray-900 rounded-lg flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#D1FE17] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="max-w-sm mx-auto">
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
                    Edit Prompt
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
