'use client';

import { useRef, useState } from 'react';
import PathDrawingCanvas, { PathDrawingCanvasHandle } from '@/components/tools/PathDrawingCanvas';
import DurationSelect, { clampVideoDuration } from '@/components/workflows/DurationSelect';
import ImageModelSelect from '@/components/workflows/ImageModelSelect';
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
import { DEFAULT_IMAGE_MODEL_ID, type ImageModelId } from '@/lib/tools/imageModels';
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
    objectDescription.trim() ? `Object interaction: weave in ${objectDescription.trim()} naturally.` : '',
    ideation?.suggestion.motionHint
      ? `Motion: ${ideation.suggestion.motionHint}`
      : 'Motion: smooth continuous camera move with light handheld energy.',
    'Keep subjects and composition from the starting frame.',
    'No red lines, arrows, UI overlays, watermarks, or on-screen text.',
  ]
    .filter(Boolean)
    .join('\n');
}

type Step = 'ideation' | 'scene' | 'draw' | 'prompt' | 'video';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'ideation', label: 'Idea' },
  { id: 'scene', label: 'Scene' },
  { id: 'draw', label: 'Path' },
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
  const [imageModel, setImageModel] = useState<ImageModelId>(DEFAULT_IMAGE_MODEL_ID);
  const [videoModel, setVideoModel] = useState<VideoModelId>(DEFAULT_VIDEO_MODEL_ID);
  const [referenceSource, setReferenceSource] = useState<VideoReferenceSource>('path');
  const [sensitiveSuggestedModel, setSensitiveSuggestedModel] = useState<VideoModelId | null>(null);
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
    if (!trimmed) { setError('Describe the scene first'); return; }
    if (!ideation) { setError('Complete style & idea first'); return; }
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
          model: imageModel,
          size: '2K',
          mode: 'none',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || 'Failed to generate the scene still');
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
    if (!sceneDescription.trim()) { setError('Scene description is required'); return; }
    if (!baseImageUrl) { setError('Upload or generate a base scene image first'); return; }
    if (!objectImageUrl) { setError('Upload an object reference image first'); return; }
    setError(null);
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
    if (!baseImageUrl) { setError('Base scene image is required before skipping the path'); return; }
    if (!objectImageUrl) { setError('Object reference is still required'); return; }
    setAnnotatedImage(null);
    setPathAnalysis(null);
    setReferenceSource('original');
    setVideoModel('grok-imagine-1.5');
    setPrompt(buildGrokSkipPathPrompt(sceneDescription, objectDescription, duration, ideation));
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
      if (!response.ok || data.error) throw new Error(data.error || 'Failed to assemble the continuous-shot prompt');
      setPrompt(typeof data.prompt === 'string' ? data.prompt : '');
      if (typeof data.duration === 'number') setDuration(clampVideoDuration(data.duration, duration));
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
    if (!objectImageUrl || !prompt.trim()) { setError('Object image and prompt are required'); return; }
    const modelToUse = modelOverride ?? videoModel;
    let source = referenceSource;
    if (modelOverride) {
      setVideoModel(modelOverride);
      setSensitiveSuggestedModel(null);
      if (modelOverride === 'grok-imagine-1.5') { source = 'original'; setReferenceSource('original'); }
    }
    const firstFrame = resolveVideoReference(source);
    if (!firstFrame) { setError('A reference image is required'); return; }
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
          referenceImages: [firstFrame, objectImageUrl],
          duration, resolution, model: modelToUse,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        if (data.code === 'SENSITIVE_CONTENT') {
          setSensitiveSuggestedModel((data.suggestedModel as VideoModelId) || 'grok-imagine-1.5');
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
    setStep('ideation'); setIdeation(null); setError(null);
    setSceneDescription(''); setObjectDescription('');
    setBaseImageUrl(null); setObjectImageUrl(null);
    setHasPath(false); setAnnotatedImage(null); setPrompt('');
    setDuration(12); setPathAnalysis(null); setVideoUrl(null);
    setVideoModel(DEFAULT_VIDEO_MODEL_ID); setReferenceSource('path');
    setSensitiveSuggestedModel(null);
  };

  return (
    <div className="space-y-3 max-w-4xl">

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

      {error && step !== 'ideation' && (
        <div className="text-xs text-red-400 bg-red-950/60 px-3 py-2.5 rounded-xl border border-red-900">
          {error}
        </div>
      )}

      {/* ── Ideation ── */}
      {step === 'ideation' && (
        <SurrealIdeationStep
          onComplete={handleIdeationComplete}
          onBack={onBack}
          stillMode="scene"
        />
      )}

      {/* ── Scene & Object ── */}
      {step === 'scene' && (
        <div className="card space-y-4">
          {ideation && (
            <div className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2">
              <p className="text-[10px] text-[#D1FE17] uppercase tracking-wide">{ideation.suggestion.scale} · {ideation.topic}</p>
              <p className="text-xs text-white font-medium mt-0.5">{ideation.suggestion.title}</p>
            </div>
          )}

          {/* Scene description */}
          <textarea
            value={sceneDescription}
            onChange={(e) => setSceneDescription(e.target.value)}
            className="input-field text-sm min-h-[100px] resize-none"
            placeholder="Scene — one hero, one twist, simple backdrop…"
          />

          {/* Base scene image */}
          <div className="space-y-2">
            <div className="flex gap-2">
              {(['generate', 'upload'] as const).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setBaseSource(src)}
                  className={`flex-1 px-3 py-2 text-xs rounded-xl border-2 font-medium transition-all ${
                    baseSource === src
                      ? 'border-[#D1FE17] text-[#D1FE17] bg-[#D1FE17]/10'
                      : 'border-gray-800 text-gray-500 hover:border-gray-600'
                  }`}
                >
                  {src === 'generate' ? 'AI generate' : 'Upload'}
                </button>
              ))}
            </div>

            {/* Image model chips */}
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500 font-medium">Image model</p>
              <ImageModelSelect value={imageModel} onChange={setImageModel} disabled={generatingImage} />
            </div>

            {baseSource === 'generate' ? (
              <button
                type="button"
                onClick={handleGenerateBase}
                disabled={generatingImage || !sceneDescription.trim()}
                className="w-full btn-primary disabled:opacity-40 text-sm py-2.5"
              >
                {generatingImage ? 'Generating…' : baseImageUrl ? 'Regenerate scene' : 'Generate scene still'}
              </button>
            ) : (
              <label className="flex items-center gap-2 px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl cursor-pointer hover:border-gray-600 transition-all">
                <span className="text-xs text-gray-400">Choose base image…</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handleUploadBase(e.target.files?.[0] ?? null)}
                />
              </label>
            )}

            {baseImageUrl && (
              <div className="w-full rounded-2xl overflow-hidden border border-gray-800 bg-gray-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={toDisplayImageUrl(baseImageUrl)}
                  alt="Base scene"
                  className="w-full object-contain max-h-64"
                />
              </div>
            )}
          </div>

          {/* Object reference */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-white">Object reference *</p>
            <label className="flex items-center gap-2 px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl cursor-pointer hover:border-gray-600 transition-all">
              <span className="text-xs text-gray-400">
                {objectImageUrl ? 'Change object image…' : 'Upload object image…'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleUploadObject(e.target.files?.[0] ?? null)}
              />
            </label>
            <input
              type="text"
              value={objectDescription}
              onChange={(e) => setObjectDescription(e.target.value)}
              className="input-field text-sm"
              placeholder="Object tweak (optional) — e.g. glowing orb, meteor"
            />
            {objectImageUrl && (
              <div className="w-28 rounded-xl overflow-hidden border border-gray-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={objectImageUrl} alt="Object" className="w-full object-contain" />
              </div>
            )}
          </div>

          {/* Duration + resolution */}
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

          {/* Video model */}
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500 font-medium">Video model</p>
            <VideoModelSelect value={videoModel} onChange={setVideoModel} />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('ideation')}
              className="px-3 py-2 text-xs text-gray-500 hover:text-white"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleContinueToDraw}
              disabled={!baseImageUrl || !objectImageUrl || !sceneDescription.trim()}
              className="flex-1 btn-primary disabled:opacity-40 text-sm py-2.5"
            >
              Draw path →
            </button>
          </div>
          <button
            type="button"
            onClick={handleSkipPathForGrok}
            disabled={!baseImageUrl || !objectImageUrl || !sceneDescription.trim()}
            className="w-full px-4 py-2.5 text-xs text-gray-400 border border-gray-800 rounded-xl disabled:opacity-40 hover:border-gray-600 transition-all"
          >
            Skip path — Grok Imagine
          </button>
        </div>
      )}

      {/* ── Draw path ── */}
      {step === 'draw' && baseImageUrl && (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-white">Draw the camera path</h2>
          <div className="max-w-sm mx-auto w-full">
            <PathDrawingCanvas
              ref={canvasRef}
              imageUrl={toDisplayImageUrl(baseImageUrl)}
              onPathChange={setHasPath}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => canvasRef.current?.undo()}
              className="px-3 py-2 text-xs text-white border border-gray-800 rounded-xl hover:border-gray-600 transition-all">
              Undo
            </button>
            <button type="button" onClick={() => canvasRef.current?.clear()}
              className="px-3 py-2 text-xs text-white border border-gray-800 rounded-xl hover:border-gray-600 transition-all">
              Clear
            </button>
            <button type="button" onClick={() => setStep('scene')}
              className="px-3 py-2 text-xs text-gray-500 hover:text-white">
              Back
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
          <h2 className="text-sm font-semibold text-white">Master prompt</h2>

          <div className="flex gap-2">
            {objectImageUrl && (
              <div className="w-20 shrink-0 rounded-xl overflow-hidden border border-gray-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={objectImageUrl} alt="Object" className="w-full object-contain" />
              </div>
            )}
            {pathAnalysis && (
              <div className="flex-1 bg-gray-950 border border-gray-800 rounded-xl p-3">
                <p className="text-[10px] font-medium text-[#D1FE17] mb-1">Traced path</p>
                <p className="text-[10px] text-gray-500 leading-relaxed">{pathAnalysis}</p>
              </div>
            )}
          </div>

          {generatingPrompt ? (
            <div className="min-h-[200px] flex items-center justify-center bg-gray-950 rounded-xl border border-gray-800">
              <div className="text-center">
                <div className="w-7 h-7 border-[3px] border-[#D1FE17] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-[10px] text-gray-500">Assembling prompt…</p>
              </div>
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
              originalImageUrl={baseImageUrl}
              pathImageUrl={annotatedImage}
              disabled={generatingVideo}
              showGrokHint={videoModel === 'grok-imagine-1.5'}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-gray-600">
            <button type="button" onClick={() => setStep(baseImageUrl ? 'draw' : 'scene')} className="hover:text-white">
              Back
            </button>
            <span>{getVideoModel(videoModel).name} · {duration}s · {resolution}</span>
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
          <h2 className="text-sm font-semibold text-white">Your continuous shot</h2>
          {generatingVideo || !videoUrl ? (
            <div className="max-w-sm mx-auto w-full aspect-[9/16] bg-gray-950 rounded-2xl border border-gray-800 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-[3px] border-[#D1FE17] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-500">Rendering continuous take…</p>
            </div>
          ) : (
            <>
              <div className="max-w-sm mx-auto w-full">
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
