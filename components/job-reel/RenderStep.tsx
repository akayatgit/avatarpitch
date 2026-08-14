'use client';

import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Download, Loader2, Minus, Plus, RefreshCw, Smartphone } from 'lucide-react';
import {
  MAX_SECTION_SECONDS,
  MIN_SECTION_SECONDS,
  isRenderStale,
  totalDurationSec,
  usableCards,
  type JobReelState,
} from '@/lib/jobReel';
import {
  renderCtaOverlayDataUrl,
  renderHookOverlayDataUrl,
  renderJobCardParts,
} from '@/lib/jobReelCards';

interface RenderSectionPayload {
  durationSec: number;
  overlays: Array<{ overlayDataUrl: string; fromSec?: number; toSec?: number }>;
  logo?: { dataUrl: string; x: number; y: number } | null;
  backgroundUrl?: string | null;
  backgroundType?: 'video' | 'image' | null;
}

interface RenderStepProps {
  state: JobReelState;
  updateState: (patch: Partial<JobReelState>) => void;
  goToStep: (step: number) => void;
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

export default function RenderStep({ state, updateState, goToStep }: RenderStepProps) {
  const [preparing, setPreparing] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const cards = usableCards(state);
  const totalSeconds = totalDurationSec(state);
  const isRendering = state.renderStatus === 'rendering';

  // Poll the render-status ticket while a render is in flight. The ticket lives
  // in localStorage, so this works across reloads and returning from other apps
  // — the server keeps rendering and parks the result in Blob either way.
  useEffect(() => {
    if (!isRendering || !state.renderTicket) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/job-reel/status?ticket=${state.renderTicket}`, {
          cache: 'no-store',
        });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled || !data?.renderStatus) return;
        if (data.renderStatus === 'completed' || data.renderStatus === 'failed') {
          updateState({
            renderStatus: data.renderStatus,
            renderError: data.renderError ?? null,
            finalVideoUrl: data.finalVideoUrl ?? null,
          });
        } else if (data.renderStatus === 'unknown' && isRenderStale(stateRef.current)) {
          // Ticket never landed (render died before writing status) — unstick the UI
          updateState({
            renderStatus: 'failed',
            renderError: 'The render did not report back. Tap render to try again.',
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
  }, [isRendering, state.renderTicket, updateState]);

  const startRender = async () => {
    if (!state.backgroundUrl || cards.length === 0) return;
    setPreparing(true);
    setError(null);
    try {
      // Make sure the browser fonts are in before rasterizing the overlays
      await (document as any).fonts?.ready;

      const ctaOn = state.cta.enabled && Boolean(
        state.cta.line1.trim() || state.cta.line2.trim() || state.cta.line3.trim()
      );
      const sectionCount = cards.length + 1 + (ctaOn ? 1 : 0);

      // Section 1 — staged hook: banner + headline from 0s, the subtitle +
      // hint pop in at the configured reveal second
      setPrepareProgress(`Preparing section 1/${sectionCount}…`);
      const revealSec = Math.min(state.hookRevealSec, state.hookDurationSec - 0.5);
      const hasReveal = Boolean(state.hook.subtitle.trim() || state.hook.hint.trim());
      const hookOverlays = hasReveal
        ? [
            {
              overlayDataUrl: renderHookOverlayDataUrl(state.hook, 'top'),
              fromSec: 0,
              toSec: revealSec,
            },
            { overlayDataUrl: renderHookOverlayDataUrl(state.hook, 'full'), fromSec: revealSec },
          ]
        : [{ overlayDataUrl: renderHookOverlayDataUrl(state.hook, 'full') }];
      const sections: RenderSectionPayload[] = [
        {
          durationSec: state.hookDurationSec,
          overlays: hookOverlays,
          backgroundUrl: state.hookBackgroundUrl,
          backgroundType: state.hookBackgroundType,
        },
      ];

      // Job cards — overlay sans logo + separate logo tile for the pop-in
      for (let index = 0; index < cards.length; index++) {
        setPrepareProgress(`Preparing section ${index + 2}/${sectionCount}…`);
        const parts = await renderJobCardParts(cards[index]);
        sections.push({
          durationSec: state.cardDurationSec,
          overlays: [{ overlayDataUrl: parts.overlayDataUrl }],
          logo: parts.logo,
          backgroundUrl: cards[index].backgroundUrl,
          backgroundType: cards[index].backgroundType,
        });
      }

      // Final CTA card
      if (ctaOn) {
        setPrepareProgress(`Preparing section ${sectionCount}/${sectionCount}…`);
        sections.push({
          durationSec: state.cta.durationSec,
          overlays: [{ overlayDataUrl: renderCtaOverlayDataUrl(state.cta) }],
          backgroundUrl: state.cta.backgroundUrl,
          backgroundType: state.cta.backgroundType,
        });
      }

      const ticket = `reel-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      updateState({
        renderStatus: 'rendering',
        renderError: null,
        renderStartedAt: new Date().toISOString(),
        renderTicket: ticket,
        finalVideoUrl: null,
      });

      // Fire the render. If the phone leaves the browser and this request dies,
      // the server keeps going and the ticket poll picks up the result.
      fetch('/api/job-reel/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket,
          background: {
            url: state.backgroundUrl,
            type: state.backgroundType ?? 'video',
          },
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
          {cards.length + 1 + (state.cta.enabled ? 1 : 0)} sections · ~{totalSeconds}s video
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
        <p className="text-[11px] text-gray-500">
          Hook reveal timing is on the hook step; the CTA card and per-section backgrounds are on
          the job cards step.
        </p>
      </div>

      {/* Render / status / result */}
      {state.finalVideoUrl && state.renderStatus === 'completed' ? (
        <div className="bg-gray-900 border border-[#D1FE17]/30 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Your job reel is ready</p>
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
          <p className="text-[11px] text-gray-500">
            Download within 48 hours — rendered files are auto-cleaned after that. You can always
            re-render this draft.
          </p>
        </div>
      ) : isRendering ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin text-[#D1FE17]" />
            Rendering your job reel (1-3 min)…
          </div>
          <p className="flex items-start gap-2 text-xs text-gray-500">
            <Smartphone className="w-4 h-4 flex-shrink-0 mt-0.5" />
            You can leave this app — rendering continues on the server. Come back to this page
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
