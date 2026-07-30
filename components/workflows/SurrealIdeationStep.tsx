'use client';

import { useEffect, useRef, useState } from 'react';
import { toDisplayImageUrl } from '@/lib/imageDisplay';
import { applyDraftRefineLocks } from '@/lib/styles/surrealTech';
import type { FootageSuggestion } from '@/lib/tools/suggestFootage';
import type { ImageStyleMode } from '@/lib/tools/imageGeneration';

export interface SurrealIdeationResult {
  /** Resolved direct image URL (pinimg / CDN) — highest-weight style ref */
  inspirationImageUrl: string;
  topic: string;
  suggestion: FootageSuggestion;
  inspirationRead: string | null;
  /** Selected Nano Banana 2 draft concept image */
  draftImageUrl: string;
  /** High-quality still refined from draft + corrections */
  finalImageUrl: string;
  corrections: string;
}

interface Props {
  onComplete: (result: SurrealIdeationResult) => void;
  onBack?: () => void;
  /** Match the workflow's still style (drone = aerial, continuous = scene) */
  stillMode?: ImageStyleMode;
}

interface DraftCard {
  suggestion: FootageSuggestion;
  imageUrl: string | null;
  error: string | null;
  loading: boolean;
}

/**
 * Shared first step for every workflow:
 * 1) paste Pinterest / inspiration image URL → thumbnail
 * 2) what the avatar will explain
 * 3) generate 6 Nano Banana 2 concept stills → pick one
 * 4) text corrections → high-quality refine from that draft
 */
export default function SurrealIdeationStep({
  onComplete,
  onBack,
  stillMode: _stillMode = 'none',
}: Props) {
  const [rawUrl, setRawUrl] = useState('');
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [inspirationRead, setInspirationRead] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [corrections, setCorrections] = useState('');
  const [finalImageUrl, setFinalImageUrl] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolveSeq = useRef(0);
  const suggestSeq = useRef(0);

  // Resolve + preview thumbnail as soon as a URL is pasted
  useEffect(() => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      setResolvedUrl(null);
      setThumbError(null);
      setResolving(false);
      return;
    }

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

  const resetDownstream = () => {
    setDrafts([]);
    setSelectedIndex(null);
    setCorrections('');
    setFinalImageUrl(null);
    setInspirationRead(null);
  };

  const generateDraftImage = async (
    suggestion: FootageSuggestion,
    inspirationImageUrl: string
  ): Promise<string> => {
    // Nano Banana: ~80% replicate Pinterest ref; keep diorama template intact
    const scenePrompt = [
      suggestion.imagePrompt.trim(),
      'CRITICAL: Match the attached inspiration/Pinterest image at ~80% fidelity — same subjects, pose, composition, colors, and lighting. Only ~20% creative adaptation.',
      'Use the attached image as the primary visual reference (highest weight). Clear open paths for a drone flythrough. No text, no watermarks, no UI overlays.',
    ].join(' ');
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenePrompt,
        referenceImageUrls: [inspirationImageUrl],
        numImages: 1,
        model: 'nano-banana-2',
        resolution: '2K',
        imageSearch: true,
        googleSearch: true,
        mode: 'none',
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to generate draft image');
    }
    const url: string | undefined = Array.isArray(data.images) ? data.images[0] : undefined;
    if (!url) throw new Error('Draft image API returned no usable image');
    return url;
  };

  const handleSuggestAsImages = async () => {
    if (!resolvedUrl) {
      setError('Paste a valid Pinterest / inspiration image URL first');
      return;
    }
    if (!topic.trim()) {
      setError('Describe what you want to explain from this image');
      return;
    }

    const seq = ++suggestSeq.current;
    setError(null);
    setSuggesting(true);
    setSelectedIndex(null);
    setFinalImageUrl(null);
    setCorrections('');
    setDrafts([]);

    try {
      const response = await fetch('/api/suggest-footage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          inspirationImageUrl: resolvedUrl,
          count: 6,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (seq !== suggestSeq.current) return;
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to invent footage concepts');
      }

      const list: FootageSuggestion[] = Array.isArray(data.suggestions) ? data.suggestions : [];
      if (list.length === 0) {
        throw new Error('No suggestions returned — try again');
      }

      const inspirationImageUrl =
        typeof data.inspirationImageUrl === 'string' ? data.inspirationImageUrl : resolvedUrl;
      setResolvedUrl(inspirationImageUrl);
      setInspirationRead(typeof data.inspirationRead === 'string' ? data.inspirationRead : null);

      const initial: DraftCard[] = list.map((suggestion) => ({
        suggestion,
        imageUrl: null,
        error: null,
        loading: true,
      }));
      setDrafts(initial);
      setSuggesting(false);

      await Promise.all(
        list.map(async (suggestion, index) => {
          try {
            const imageUrl = await generateDraftImage(suggestion, inspirationImageUrl);
            if (seq !== suggestSeq.current) return;
            setDrafts((prev) =>
              prev.map((card, i) =>
                i === index ? { ...card, imageUrl, loading: false, error: null } : card
              )
            );
          } catch (err) {
            if (seq !== suggestSeq.current) return;
            setDrafts((prev) =>
              prev.map((card, i) =>
                i === index
                  ? {
                      ...card,
                      loading: false,
                      error: err instanceof Error ? err.message : 'Draft failed',
                    }
                  : card
              )
            );
          }
        })
      );
    } catch (err) {
      if (seq === suggestSeq.current) {
        setError(err instanceof Error ? err.message : 'Failed to generate suggestion images');
        setSuggesting(false);
      }
    }
  };

  const handleRefineHighQuality = async () => {
    if (!resolvedUrl) {
      setError('Inspiration image is required');
      return;
    }
    if (selectedIndex == null || !drafts[selectedIndex]?.imageUrl) {
      setError('Pick one draft image first');
      return;
    }

    const selected = drafts[selectedIndex];
    setError(null);
    setRefining(true);
    setFinalImageUrl(null);
    try {
      const scenePrompt = applyDraftRefineLocks(
        selected.suggestion.imagePrompt,
        corrections,
        selected.suggestion.scale
      );
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenePrompt,
          // Inspiration first (subject lock), draft second (chosen concept)
          referenceImageUrls: [resolvedUrl, selected.imageUrl],
          numImages: 1,
          size: '2K',
          mode: 'none',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate high-quality image');
      }
      const url: string | undefined = Array.isArray(data.images) ? data.images[0] : undefined;
      if (!url) throw new Error('High-quality image API returned no usable image');
      setFinalImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refine high-quality image');
    } finally {
      setRefining(false);
    }
  };

  const handleContinue = () => {
    if (!resolvedUrl) {
      setError('Inspiration image is required');
      return;
    }
    if (selectedIndex == null || !drafts[selectedIndex]?.imageUrl) {
      setError('Pick one draft image first');
      return;
    }
    if (!finalImageUrl) {
      setError('Generate the high-quality image before continuing');
      return;
    }
    onComplete({
      inspirationImageUrl: resolvedUrl,
      topic: topic.trim(),
      suggestion: drafts[selectedIndex].suggestion,
      inspirationRead,
      draftImageUrl: drafts[selectedIndex].imageUrl!,
      finalImageUrl,
      corrections: corrections.trim(),
    });
  };

  const draftsReady = drafts.length > 0;
  const anyDraftLoading = drafts.some((d) => d.loading);
  const selectedDraft = selectedIndex != null ? drafts[selectedIndex] : null;

  return (
    <div className="card space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">1. Inspiration + idea</h2>
          <p className="text-sm text-gray-400 mt-1">
            Paste inspiration — we invent 6 isometric miniature diorama worlds (Nano Banana
            template) a drone can fly through. Pick one, correct in text, refine HQ.
          </p>
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

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 p-3 rounded-xl border border-red-800">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="inspo-url" className="block text-sm font-medium text-white mb-2">
          Pinterest / inspiration image URL *
        </label>
        <input
          id="inspo-url"
          type="url"
          value={rawUrl}
          onChange={(e) => {
            setRawUrl(e.target.value);
            resetDownstream();
          }}
          className="input-field"
          placeholder="https://pin.it/... or https://i.pinimg.com/... or https://www.pinterest.com/pin/..."
        />
        <p className="mt-1 text-[11px] text-gray-500">
          Supports pin.it short links, full Pinterest pin URLs, and direct pinimg.com image addresses.
        </p>
      </div>

      <div className="flex items-start gap-4">
        <div className="w-28 shrink-0 aspect-[9/16] rounded-lg border border-gray-700 bg-gray-900 overflow-hidden flex items-center justify-center">
          {resolving ? (
            <div className="w-6 h-6 border-2 border-[#D1FE17] border-t-transparent rounded-full animate-spin" />
          ) : resolvedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={toDisplayImageUrl(resolvedUrl)}
              alt="Inspiration thumbnail"
              className="w-full h-full object-cover"
              onError={() =>
                setThumbError('Thumbnail failed to load — try a direct pinimg.com image URL')
              }
            />
          ) : (
            <span className="text-[10px] text-gray-500 px-2 text-center">Thumbnail</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {thumbError && <p className="text-xs text-red-400 mb-2">{thumbError}</p>}
          {resolvedUrl && !thumbError && (
            <p className="text-xs text-[#D1FE17] mb-2">Inspiration loaded — highest style weight</p>
          )}
          <label htmlFor="topic" className="block text-sm font-medium text-white mb-2">
            What will you explain from this image? *
          </label>
          <textarea
            id="topic"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              if (draftsReady) resetDownstream();
            }}
            className="input-field min-h-[100px]"
            placeholder='e.g. "Why fresher SE salaries in Bangalore are high" — keep THIS image look'
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSuggestAsImages}
        disabled={suggesting || anyDraftLoading || resolving || !resolvedUrl || !topic.trim()}
        className="w-full btn-primary disabled:opacity-50 min-h-[44px]"
      >
        {suggesting || anyDraftLoading
          ? 'Generating 6 Nano Banana concepts...'
          : 'Generate suggestion images (Nano Banana 2)'}
      </button>

      {inspirationRead && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-[11px] font-medium text-[#D1FE17] mb-1">Inspiration read</p>
          <p className="text-[11px] text-gray-400 leading-relaxed">{inspirationRead}</p>
        </div>
      )}

      {draftsReady && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-white">Pick one concept still</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {drafts.map((card, i) => {
              const selected = selectedIndex === i;
              return (
                <button
                  key={`${card.suggestion.title}-${i}`}
                  type="button"
                  disabled={!card.imageUrl || card.loading}
                  onClick={() => {
                    setSelectedIndex(i);
                    setFinalImageUrl(null);
                  }}
                  className={`text-left rounded-xl border-2 overflow-hidden transition-colors ${
                    selected
                      ? 'border-[#D1FE17] bg-[#D1FE17]/10'
                      : 'border-gray-800 bg-gray-900 hover:border-gray-600'
                  } disabled:opacity-60`}
                >
                  <div className="aspect-[9/16] bg-gray-950 flex items-center justify-center relative">
                    {card.loading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-[#D1FE17] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] text-gray-500">Nano Banana...</span>
                      </div>
                    )}
                    {card.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={toDisplayImageUrl(card.imageUrl)}
                        alt={card.suggestion.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {card.error && !card.loading && (
                      <p className="text-[10px] text-red-400 px-3 text-center">{card.error}</p>
                    )}
                  </div>
                  <div className="p-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-white line-clamp-2">
                        {card.suggestion.title}
                      </h3>
                      <span className="text-[9px] uppercase tracking-wide text-[#D1FE17] shrink-0">
                        {card.suggestion.scale}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 line-clamp-2">{card.suggestion.concept}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedDraft?.imageUrl && (
        <div className="space-y-3 border-t border-gray-800 pt-4">
          <div>
            <label htmlFor="corrections" className="block text-sm font-medium text-white mb-2">
              Corrections for the high-quality version
            </label>
            <textarea
              id="corrections"
              value={corrections}
              onChange={(e) => {
                setCorrections(e.target.value);
                setFinalImageUrl(null);
              }}
              className="input-field min-h-[90px]"
              placeholder='e.g. "more silicon mountains on the left, remove the floating logo, brighter golden hour, keep the chip river"'
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Optional. Inspiration locks subjects; the draft guides the tech twist; your text fixes
              the rest.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefineHighQuality}
            disabled={refining}
            className="w-full btn-primary disabled:opacity-50 min-h-[44px]"
          >
            {refining ? 'Generating high-quality still...' : 'Generate high-quality from draft'}
          </button>

          {finalImageUrl && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-white">High-quality still</p>
              <div className="max-w-xs mx-auto aspect-[9/16] rounded-lg border border-[#D1FE17]/40 overflow-hidden bg-gray-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={toDisplayImageUrl(finalImageUrl)}
                  alt="High-quality concept still"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={handleContinue}
                className="w-full btn-primary min-h-[44px]"
              >
                Use this still → continue workflow
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
