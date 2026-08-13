'use client';

import { useEffect, useRef, useState } from 'react';
import ImageModelSelect from '@/components/workflows/ImageModelSelect';
import { toDisplayImageUrl } from '@/lib/imageDisplay';
import { applyDraftRefineLocks } from '@/lib/styles/surrealTech';
import { DEFAULT_IMAGE_MODEL_ID, type ImageModelId } from '@/lib/tools/imageModels';
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
  stillMode?: ImageStyleMode;
}

interface DraftCard {
  suggestion: FootageSuggestion;
  imageUrl: string | null;
  error: string | null;
  loading: boolean;
}

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
  const [imageModel, setImageModel] = useState<ImageModelId>(DEFAULT_IMAGE_MODEL_ID);
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
    const scenePrompt = [
      suggestion.imagePrompt.trim(),
      'CRITICAL: Match the attached inspiration/Pinterest image at ~80% fidelity — same subjects, pose, composition, colors, and lighting. Only ~20% creative adaptation.',
      'Use the attached image as the primary visual reference (highest weight). Clear open paths for a drone flythrough. No text, no watermarks, no UI overlays.',
    ].join(' ');
    const response = await fetch('/api/workflows/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenePrompt,
        referenceImageUrls: [inspirationImageUrl],
        numImages: 1,
        model: imageModel,
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
      setError('Describe what you want to explain');
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
      if (list.length === 0) throw new Error('No suggestions returned — try again');

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
                  ? { ...card, loading: false, error: err instanceof Error ? err.message : 'Draft failed' }
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
    if (!resolvedUrl) { setError('Inspiration image is required'); return; }
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
      const response = await fetch('/api/workflows/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenePrompt,
          referenceImageUrls: [resolvedUrl, selected.imageUrl],
          numImages: 1,
          model: imageModel,
          size: '2K',
          mode: 'none',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || 'Failed to generate high-quality image');
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
    if (!resolvedUrl) { setError('Inspiration image is required'); return; }
    if (selectedIndex == null || !drafts[selectedIndex]?.imageUrl) {
      setError('Pick one draft image first');
      return;
    }
    if (!finalImageUrl) { setError('Generate the high-quality image before continuing'); return; }
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
    <div className="card space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white tracking-tight">Inspiration</h2>
        {onBack && (
          <button type="button" onClick={onBack} className="text-xs text-gray-500 hover:text-white">
            All templates
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-950/60 px-3 py-2.5 rounded-xl border border-red-900">
          {error}
        </div>
      )}

      {/* Pinterest / image URL */}
      <input
        id="inspo-url"
        type="url"
        value={rawUrl}
        onChange={(e) => { setRawUrl(e.target.value); resetDownstream(); }}
        className="input-field text-sm"
        placeholder="Paste a pin.it or pinterest.com URL…"
      />

      {/* Inspiration image preview — full width */}
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
              alt="Inspiration"
              className="w-full max-h-72 object-contain"
              onError={() => setThumbError('Thumbnail failed to load — try a direct pinimg.com URL')}
            />
          ) : null}
        </div>
      )}

      {/* Topic */}
      <textarea
        id="topic"
        value={topic}
        onChange={(e) => { setTopic(e.target.value); if (draftsReady) resetDownstream(); }}
        className="input-field text-sm min-h-[80px] resize-none"
        placeholder='What will you explain? e.g. "Why SE salaries in Bangalore are rising"'
      />

      {/* Image model chips */}
      <div className="space-y-1.5">
        <p className="text-xs text-gray-500 font-medium">Image model</p>
        <ImageModelSelect
          value={imageModel}
          onChange={setImageModel}
          disabled={suggesting || anyDraftLoading || refining}
        />
      </div>

      {/* Generate concepts */}
      <button
        type="button"
        onClick={handleSuggestAsImages}
        disabled={suggesting || anyDraftLoading || resolving || !resolvedUrl || !topic.trim()}
        className="w-full btn-primary disabled:opacity-40 text-sm py-3"
      >
        {suggesting || anyDraftLoading
          ? `Generating with ${imageModel === 'seedream-3' ? 'Seedream 3' : 'Nano Banana 2'}…`
          : 'Generate 6 concepts'}
      </button>

      {/* Inspiration read (collapsed into a chip) */}
      {inspirationRead && (
        <details className="group">
          <summary className="text-[11px] text-[#D1FE17] cursor-pointer select-none list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">›</span>
            Inspiration notes
          </summary>
          <p className="mt-1.5 text-[11px] text-gray-500 leading-relaxed">{inspirationRead}</p>
        </details>
      )}

      {/* Draft concept grid */}
      {draftsReady && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-white">Pick a concept</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {drafts.map((card, i) => {
              const selected = selectedIndex === i;
              return (
                <button
                  key={`${card.suggestion.title}-${i}`}
                  type="button"
                  disabled={!card.imageUrl || card.loading}
                  onClick={() => { setSelectedIndex(i); setFinalImageUrl(null); }}
                  className={`text-left rounded-2xl border-2 overflow-hidden transition-all active:scale-[0.98] ${
                    selected
                      ? 'border-[#D1FE17] shadow-[0_0_12px_rgba(209,254,23,0.2)]'
                      : 'border-gray-800 hover:border-gray-600'
                  } disabled:opacity-60`}
                >
                  <div className="aspect-[9/16] bg-gray-950 flex items-center justify-center relative">
                    {card.loading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                        <div className="w-5 h-5 border-2 border-[#D1FE17] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[9px] text-gray-600">Generating…</span>
                      </div>
                    )}
                    {card.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={toDisplayImageUrl(card.imageUrl)}
                        alt={card.suggestion.title}
                        className="w-full h-full object-contain"
                      />
                    )}
                    {card.error && !card.loading && (
                      <p className="text-[9px] text-red-400 px-2 text-center">{card.error}</p>
                    )}
                  </div>
                  <div className="p-2 space-y-0.5 bg-black">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-[10px] font-semibold text-white line-clamp-1">
                        {card.suggestion.title}
                      </h3>
                      <span className="text-[8px] uppercase tracking-wide text-[#D1FE17] shrink-0">
                        {card.suggestion.scale}
                      </span>
                    </div>
                    <p className="text-[9px] text-gray-600 line-clamp-2">{card.suggestion.concept}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Corrections + HQ refine */}
      {selectedDraft?.imageUrl && (
        <div className="space-y-3 pt-2 border-t border-gray-900">
          <textarea
            id="corrections"
            value={corrections}
            onChange={(e) => { setCorrections(e.target.value); setFinalImageUrl(null); }}
            className="input-field text-sm min-h-[72px] resize-none"
            placeholder='Corrections (optional) — e.g. "brighter golden hour, more mountains left"'
          />

          <button
            type="button"
            onClick={handleRefineHighQuality}
            disabled={refining}
            className="w-full btn-primary disabled:opacity-40 text-sm py-3"
          >
            {refining ? 'Refining…' : 'Refine to HD'}
          </button>

          {finalImageUrl && (
            <div className="space-y-3">
              <div className="w-full rounded-2xl overflow-hidden border border-[#D1FE17]/30 bg-gray-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={toDisplayImageUrl(finalImageUrl)}
                  alt="High-quality concept still"
                  className="w-full object-contain max-h-[70vh]"
                />
              </div>
              <button
                type="button"
                onClick={handleContinue}
                className="w-full btn-primary text-sm py-3"
              >
                Use this → continue
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
