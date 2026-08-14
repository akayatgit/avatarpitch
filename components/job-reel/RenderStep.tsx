'use client';

import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Download, Loader2, Minus, Plus, RefreshCw, Smartphone } from 'lucide-react';
import {
  MAX_SECTION_SECONDS,
  MIN_SECTION_SECONDS,
  totalDurationSec,
  usableCards,
  type JobReelState,
} from '@/lib/jobReel';
import { renderHookOverlayBlob, renderJobCardOverlayBlob } from '@/lib/jobReelCards';

interface RenderStepProps {
  state: JobReelState;
  projectId: string | null;
  updateState: (patch: Partial<JobReelState>) => void;
  /** Persist immediately (optionally an explicit snapshot) and resolve with the project id. */
  persistNow: (overrideState?: JobReelState) => Promise<string | null>;
  goToStep: (step: number) => void;
}

async function uploadOverlay(blob: Blob, name: string): Promise<string> {
  const formData = new FormData();
  formData.append('images', new File([blob], name, { type: 'image/png' }));
  const response = await fetch('/api/upload-image', { method: 'POST', body: formData });
  const data = await response.json();
  if (!response.ok || !data?.url) {
    throw new Error(data?.error || 'Overlay upload failed');
  }
  return data.url;
}

function DurationStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-gray-300">{label}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(MIN_SECTION_SECONDS, value - 1))}
          disabled={value <= MIN_SECTION_SECONDS}
          className="w-9 h-9 rounded-lg border border-gray-700 text-gray-300 flex items-center justify-center disabled:opacity-30 touch-manipulation"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="text-sm text-white font-semibold w-8 text-center">{value}s</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(MAX_SECTION_SECONDS, value + 1))}
          disabled={value >= MAX_SECTION_SECONDS}
          className="w-9 h-9 rounded-lg border border-gray-700 text-gray-300 flex items-center justify-center disabled:opacity-30 touch-manipulation"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function RenderStep({
  state,
  projectId,
  updateState,
  persistNow,
  goToStep,
}: RenderStepProps) {
  const [preparing, setPreparing] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const cards = usableCards(state);
  const totalSeconds = totalDurationSec(state);
  const isRendering = state.renderStatus === 'rendering';

  // Poll the server while a render is in flight. Works across page reloads and
  // returning from other apps — the server keeps rendering either way.
  useEffect(() => {
    if (!isRendering || !projectId) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/job-reel/status?projectId=${projectId}`, {
          cache: 'no-store',
        });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled || !data?.renderStatus) return;
        if (data.renderStatus !== 'rendering') {
          updateState({
            renderStatus: data.renderStatus,
            renderError: data.renderError ?? null,
            finalVideoUrl: data.finalVideoUrl ?? null,
          });
        }
      } catch {
        // Transient network errors are fine — next tick retries
      }
    };

    const interval = setInterval(poll, 5000);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isRendering, projectId, updateState]);

  const startRender = async () => {
    if (!state.backgroundUrl || cards.length === 0) return;
    setPreparing(true);
    setError(null);
    try {
      // Make sure the browser fonts are in before rasterizing the overlays
      await (document as any).fonts?.ready;

      setPrepareProgress(`Preparing section 1/${cards.length + 1}…`);
      const hookBlob = await renderHookOverlayBlob(state.hook);
      const hookUrl = await uploadOverlay(hookBlob, 'hook.png');

      const sections: Array<{ overlayUrl: string; durationSec: number }> = [
        { overlayUrl: hookUrl, durationSec: state.hookDurationSec },
      ];
      for (let index = 0; index < cards.length; index++) {
        setPrepareProgress(`Preparing section ${index + 2}/${cards.length + 1}…`);
        const blob = await renderJobCardOverlayBlob(cards[index]);
        const url = await uploadOverlay(blob, `card-${index + 1}.png`);
        sections.push({ overlayUrl: url, durationSec: state.cardDurationSec });
      }

      // Persist the "rendering" state before kicking off, so leaving the app is safe
      const renderingState: JobReelState = {
        ...stateRef.current,
        renderStatus: 'rendering',
        renderError: null,
        renderStartedAt: new Date().toISOString(),
        finalVideoUrl: null,
        step: 4,
      };
      updateState({
        renderStatus: 'rendering',
        renderError: null,
        renderStartedAt: renderingState.renderStartedAt,
        finalVideoUrl: null,
      });
      const savedProjectId = await persistNow(renderingState);

      // Fire the render. If the phone leaves the browser and this request dies,
      // the server keeps going and the status poll picks up the result.
      fetch('/api/job-reel/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: savedProjectId,
          backgroundUrl: state.backgroundUrl,
          backgroundType: state.backgroundType ?? 'video',
          sections,
        }),
      })
        .then(async (response) => {
          const data = await response.json().catch(() => null);
          if (response.ok && data?.finalVideoUrl) {
            updateState({ renderStatus: 'completed', finalVideoUrl: data.finalVideoUrl });
          } else if (data?.error) {
            updateState({ renderStatus: 'failed', renderError: data.error });
          }
        })
        .catch(() => {
          // Connection dropped (app backgrounded etc.) — polling takes over
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the render');
      updateState({ renderStatus: 'idle' });
    } finally {
      setPreparing(false);
      setPrepareProgress('');
    }
  };

  const downloadName = `${(state.hook.headline.trim() || 'job-reel')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()}-reel.mp4`;

  return (
    <div className="space-y-4">
      {/* Summary + durations */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
        <p className="text-sm text-white font-medium">
          {cards.length + 1} sections · ~{totalSeconds}s video
        </p>
        <DurationStepper
          label="Hook section duration"
          value={state.hookDurationSec}
          onChange={(value) => updateState({ hookDurationSec: value })}
        />
        <DurationStepper
          label="Each job card duration"
          value={state.cardDurationSec}
          onChange={(value) => updateState({ cardDurationSec: value })}
        />
      </div>

      {/* Render / status / result */}
      {state.finalVideoUrl && state.renderStatus === 'completed' ? (
        <div className="bg-gray-900 border border-[#D1FE17]/30 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Your job reel is ready</p>
          <p className="text-xs text-amber-400/90 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-2">
            Download within 48 hours — files are auto-cleaned after that. You can always
            re-render the same reel later.
          </p>
          <video
            src={state.finalVideoUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full rounded-lg bg-black max-h-[420px]"
          />
          <div className="flex gap-2">
            <a
              href={state.finalVideoUrl}
              download={downloadName}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm py-2.5 min-h-[48px] touch-manipulation"
            >
              <Download className="w-4 h-4" />
              Download video
            </a>
            <button
              type="button"
              disabled={preparing}
              onClick={startRender}
              className="btn-secondary flex items-center justify-center gap-2 text-sm py-2.5 px-4 min-h-[48px] disabled:opacity-40 touch-manipulation"
            >
              <RefreshCw className="w-4 h-4" />
              Re-render
            </button>
          </div>
        </div>
      ) : isRendering ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin text-[#D1FE17]" />
            Rendering your job reel (1-3 min)…
          </div>
          <p className="flex items-start gap-2 text-xs text-gray-500">
            <Smartphone className="w-4 h-4 flex-shrink-0 mt-0.5" />
            You can leave this app — rendering continues on the server. Come back to this project
            anytime and the download will be waiting.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {preparing ? (
            <div className="flex items-center gap-2 text-sm text-gray-300 bg-black/40 border border-gray-800 rounded-lg px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-[#D1FE17]" />
              {prepareProgress || 'Preparing sections…'}
            </div>
          ) : (
            <button
              type="button"
              onClick={startRender}
              disabled={!state.backgroundUrl || cards.length === 0}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-3 min-h-[48px] disabled:opacity-40 touch-manipulation"
            >
              <Clapperboard className="w-4 h-4" />
              Render job reel
            </button>
          )}

          {state.renderStatus === 'failed' && state.renderError && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {state.renderError}
            </p>
          )}
          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => goToStep(3)}
        className="btn-ghost w-full min-h-[44px] touch-manipulation"
      >
        ← Back to job cards
      </button>
    </div>
  );
}
