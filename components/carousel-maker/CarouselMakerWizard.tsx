'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Sparkles } from 'lucide-react';
import {
  CarouselMakerStateSchema,
  MAX_GENERATIONS_PER_SLIDE,
  canAddContentSlide,
  canDeleteSlide,
  composeSlidePrompt,
  createCarouselSlide,
  createEmptyCarouselState,
  selectedGeneration,
  slideGenerationBlockers,
  slideLabel,
  type CarouselMakerState,
  type CarouselSlide,
} from '@/lib/carouselMaker';
import ReferenceImagePicker from './ReferenceImagePicker';
import SlideLab from './SlideLab';

/** The single draft lives in the browser — no accounts, no database. */
const STORAGE_KEY = 'carouselMakerDraft_v1';

function loadDraft(): CarouselMakerState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const result = CarouselMakerStateSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function saveDraft(state: CarouselMakerState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Could not save the carousel draft locally:', error);
  }
}

export default function CarouselMakerWizard() {
  const [state, setState] = useState<CarouselMakerState>(createEmptyCarouselState());
  const [hydrated, setHydrated] = useState(false);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [generateError, setGenerateError] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const draft = loadDraft();
    if (draft) setState(draft);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDraft(state);
  }, [state, hydrated]);

  const updateSlide = useCallback((slideId: string, patch: Partial<CarouselSlide>) => {
    setState((prev) => ({
      ...prev,
      slides: prev.slides.map((slide) =>
        slide.id === slideId ? { ...slide, ...patch } : slide
      ),
    }));
  }, []);

  const setActiveSlide = useCallback((slideId: string) => {
    setState((prev) => ({ ...prev, activeSlideId: slideId }));
    setGenerateError(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const addContentSlide = useCallback(() => {
    setState((prev) => {
      if (!canAddContentSlide(prev)) return prev;
      const slide = createCarouselSlide('content');
      const ctaIndex = prev.slides.findIndex((entry) => entry.role === 'cta');
      const slides = [...prev.slides];
      slides.splice(ctaIndex === -1 ? slides.length : ctaIndex, 0, slide);
      return { ...prev, slides, activeSlideId: slide.id };
    });
  }, []);

  const deleteSlide = useCallback((slideId: string) => {
    setState((prev) => {
      if (!canDeleteSlide(prev, slideId)) return prev;
      const index = prev.slides.findIndex((entry) => entry.id === slideId);
      const slides = prev.slides.filter((entry) => entry.id !== slideId);
      const fallback = slides[Math.max(0, index - 1)];
      return {
        ...prev,
        slides,
        activeSlideId: prev.activeSlideId === slideId ? fallback.id : prev.activeSlideId,
      };
    });
  }, []);

  const startNew = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // best effort
    }
    setState(createEmptyCarouselState());
    setGenerateError(null);
  }, []);

  const generateSlide = useCallback(async (slideId: string) => {
    const current = stateRef.current;
    const slide = current.slides.find((entry) => entry.id === slideId);
    if (!slide) return;

    const blockers = slideGenerationBlockers(current, slide);
    if (blockers.length > 0) {
      setGenerateError(blockers.join(' · '));
      return;
    }

    setGenerateError(null);
    setGeneratingIds((prev) => new Set(prev).add(slideId));
    try {
      const { prompt, referenceImageUrls } = composeSlidePrompt({
        styleId: current.styleId,
        slide,
        subjectImageUrls: current.subjectImageUrls,
      });

      const response = await fetch('/api/carousel-maker/generate-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, referenceImageUrls }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.imageUrl) {
        throw new Error(data?.error || 'Generation failed — try again');
      }

      const generation = {
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        imageUrl: data.imageUrl as string,
        prompt,
        createdAt: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        slides: prev.slides.map((entry) =>
          entry.id === slideId
            ? {
                ...entry,
                generations: [...entry.generations, generation].slice(
                  -MAX_GENERATIONS_PER_SLIDE
                ),
                selectedGenerationId: generation.id,
              }
            : entry
        ),
      }));
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(slideId);
        return next;
      });
    }
  }, []);

  if (!hydrated) {
    // One paint without the draft would flash the empty state — wait for localStorage
    return <div className="max-w-lg mx-auto px-4 pb-16" />;
  }

  const activeSlide =
    state.slides.find((entry) => entry.id === state.activeSlideId) ?? state.slides[0];
  const activeLabel = slideLabel(state, activeSlide.id);
  const activeGenerating = generatingIds.has(activeSlide.id);
  const activeBlockers = slideGenerationBlockers(state, activeSlide);
  const hasGenerated = activeSlide.generations.length > 0;

  return (
    <div className="max-w-lg mx-auto px-4 pb-36">
      {/* Header */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate">Carousel Maker</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Your face + a movie poster → grandeur job carousel
          </p>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="flex items-center gap-1 text-xs text-gray-300 border border-gray-700 rounded-lg px-3 py-2 hover:bg-gray-900 flex-shrink-0 min-h-[40px] touch-manipulation"
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      {/* Subject — the face lock, shared by every slide */}
      <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4 mb-6">
        <ReferenceImagePicker
          label="You — the subject"
          hint="Clear photos of your face. Every slide keeps this exact identity."
          urls={state.subjectImageUrls}
          onChange={(urls) => setState((prev) => ({ ...prev, subjectImageUrls: urls }))}
          max={3}
        />
      </div>

      {/* Slide strip */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 mb-6">
        {state.slides.map((slide) => {
          const isActive = slide.id === activeSlide.id;
          const thumb = selectedGeneration(slide);
          const isBusy = generatingIds.has(slide.id);
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveSlide(slide.id)}
              className="flex-shrink-0 flex flex-col items-center gap-1 touch-manipulation"
            >
              <span
                className={`relative w-14 aspect-[4/5] rounded-lg overflow-hidden border-2 flex items-center justify-center bg-gray-950 ${
                  isActive ? 'border-[#D1FE17]' : 'border-gray-800'
                }`}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb.imageUrl}
                    alt={slideLabel(state, slide.id)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Sparkles className="w-4 h-4 text-gray-700" />
                )}
                {isBusy && (
                  <span className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-[#D1FE17] animate-spin" />
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  isActive ? 'text-[#D1FE17]' : 'text-gray-500'
                }`}
              >
                {slideLabel(state, slide.id)}
              </span>
            </button>
          );
        })}

        {canAddContentSlide(state) && (
          <button
            type="button"
            onClick={addContentSlide}
            className="flex-shrink-0 flex flex-col items-center gap-1 touch-manipulation"
            aria-label="Add content slide"
          >
            <span className="w-14 aspect-[4/5] rounded-lg border-2 border-dashed border-gray-700 text-gray-500 flex items-center justify-center active:border-[#D1FE17] active:text-[#D1FE17]">
              <Plus className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-medium text-gray-500">Add</span>
          </button>
        )}
      </div>

      {/* Active slide workspace */}
      <SlideLab
        slide={activeSlide}
        label={activeLabel}
        generating={activeGenerating}
        canDelete={canDeleteSlide(state, activeSlide.id)}
        updateSlide={(patch) => updateSlide(activeSlide.id, patch)}
        onDeleteSlide={() => deleteSlide(activeSlide.id)}
        onSelectGeneration={(generationId) =>
          updateSlide(activeSlide.id, { selectedGenerationId: generationId })
        }
        onDeleteGeneration={(generationId) => {
          const generations = activeSlide.generations.filter(
            (entry) => entry.id !== generationId
          );
          updateSlide(activeSlide.id, {
            generations,
            selectedGenerationId: generations.length
              ? generations[generations.length - 1].id
              : null,
          });
        }}
      />

      {/* Sticky primary action — always in the thumb zone */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-black/90 backdrop-blur border-t border-gray-800">
        <div className="max-w-lg mx-auto px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {(generateError || activeBlockers.length > 0) && (
            <p
              className={`text-xs mb-2 ${generateError ? 'text-red-400' : 'text-gray-500'}`}
            >
              {generateError ?? activeBlockers.join(' · ')}
            </p>
          )}
          <button
            type="button"
            onClick={() => generateSlide(activeSlide.id)}
            disabled={activeGenerating || activeBlockers.length > 0}
            className="w-full min-h-[52px] rounded-xl bg-[#D1FE17] text-black font-bold text-base flex items-center justify-center gap-2 touch-manipulation disabled:opacity-40 active:bg-[#B8E014]"
          >
            {activeGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating {activeLabel}…
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                {hasGenerated ? `Regenerate ${activeLabel}` : `Generate ${activeLabel}`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
