'use client';

import { useState } from 'react';
import { ArrowRight, ClipboardPaste, Link2, Loader2, RefreshCw } from 'lucide-react';
import type { JobReelState } from '@/lib/jobReel';

interface BackgroundStepProps {
  state: JobReelState;
  updateState: (patch: Partial<JobReelState>) => void;
  goToStep: (step: number) => void;
}

export default function BackgroundStep({ state, updateState, goToStep }: BackgroundStepProps) {
  const [url, setUrl] = useState(state.backgroundSourceUrl);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveBackground = async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      setError('Paste a Pinterest link first');
      return;
    }
    setResolving(true);
    setError(null);
    try {
      const response = await fetch('/api/job-reel/resolve-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await response.json();
      if (!response.ok || !data?.backgroundUrl) {
        throw new Error(data?.error || 'Could not download that background');
      }
      updateState({
        backgroundSourceUrl: trimmed,
        backgroundUrl: data.backgroundUrl,
        backgroundType: data.backgroundType === 'image' ? 'image' : 'video',
        // A new background invalidates any previously rendered video
        finalVideoUrl: null,
        renderStatus: 'idle',
        renderError: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download that background');
    } finally {
      setResolving(false);
    }
  };

  /** One tap: read the clipboard and start downloading immediately. */
  const pasteAndResolve = async () => {
    setError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setError('Your clipboard is empty — copy the Pinterest link first');
        return;
      }
      setUrl(text.trim());
      await resolveBackground(text);
    } catch {
      setError('Could not read the clipboard — paste the link into the box instead');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <p className="text-sm text-white font-medium">Background video from Pinterest</p>
        <p className="text-xs text-gray-500">
          Copy any pin link in the Pinterest app (Share → Copy link), then tap Paste. The video
          downloads automatically.
        </p>

        <button
          type="button"
          onClick={pasteAndResolve}
          disabled={resolving}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-3 min-h-[48px] disabled:opacity-40 touch-manipulation"
        >
          {resolving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ClipboardPaste className="w-4 h-4" />
          )}
          {resolving ? 'Downloading from Pinterest…' : 'Paste Pinterest link'}
        </button>

        {/* Manual fallback for browsers that block clipboard access */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                if (pasted.trim()) {
                  e.preventDefault();
                  setUrl(pasted.trim());
                  void resolveBackground(pasted);
                }
              }}
              placeholder="https://pin.it/…"
              className="input-field text-sm pl-9 min-h-[44px]"
            />
          </div>
          <button
            type="button"
            onClick={() => resolveBackground(url)}
            disabled={resolving || !url.trim()}
            className="btn-secondary text-sm px-4 min-h-[44px] disabled:opacity-40 touch-manipulation"
          >
            Fetch
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Downloaded background preview */}
      {state.backgroundUrl && (
        <div className="bg-gray-900 border border-[#D1FE17]/30 rounded-xl p-4 space-y-3">
          <p className="text-sm text-white font-medium">
            Background ready{state.backgroundType === 'image' ? ' (still image — gets a slow zoom)' : ''}
          </p>
          <div className="relative aspect-[9/16] w-full max-w-[220px] mx-auto rounded-xl overflow-hidden bg-black border border-gray-800">
            {state.backgroundType === 'video' ? (
              <video
                src={state.backgroundUrl}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.backgroundUrl}
                alt="Background"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={pasteAndResolve}
              disabled={resolving}
              className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm py-2.5 min-h-[44px] disabled:opacity-40 touch-manipulation"
            >
              <RefreshCw className="w-4 h-4" />
              Replace
            </button>
            <button
              type="button"
              onClick={() => goToStep(2)}
              className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm py-2.5 min-h-[44px] touch-manipulation"
            >
              Next: Hook
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
