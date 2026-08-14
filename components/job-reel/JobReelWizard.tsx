'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  JobReelStateSchema,
  createEmptyJobReelState,
  usableCards,
  type JobReelCard,
  type JobReelHook,
  type JobReelState,
} from '@/lib/jobReel';
import BackgroundStep from './BackgroundStep';
import HookStep from './HookStep';
import JobCardsStep from './JobCardsStep';
import RenderStep from './RenderStep';

/** The single draft lives in the browser — no accounts, no database. */
const STORAGE_KEY = 'jobReelDraft_v1';

const STEPS = [
  { number: 1, label: 'Background' },
  { number: 2, label: 'Hook' },
  { number: 3, label: 'Job cards' },
  { number: 4, label: 'Video' },
];

function loadDraft(): JobReelState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const result = JobReelStateSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function saveDraft(state: JobReelState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Quota exceeded (huge logos) — drop logos and retry once so text survives
    try {
      const slim: JobReelState = {
        ...state,
        cards: state.cards.map((card) => ({ ...card, logoUrl: null })),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch {
      console.error('Could not save the draft locally:', error);
    }
  }
}

export default function JobReelWizard() {
  const [state, setState] = useState<JobReelState>(createEmptyJobReelState());
  const [hydrated, setHydrated] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  // Restore the draft once on mount (client-only — localStorage)
  useEffect(() => {
    const draft = loadDraft();
    if (draft) setState(draft);
    setHydrated(true);
  }, []);

  // Persist every change locally (cheap sync write, no debounce needed)
  useEffect(() => {
    if (!hydrated) return;
    saveDraft(state);
  }, [state, hydrated]);

  const updateState = useCallback((patch: Partial<JobReelState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateHook = useCallback((patch: Partial<JobReelHook>) => {
    setState((prev) => ({ ...prev, hook: { ...prev.hook, ...patch } }));
  }, []);

  const updateCard = useCallback((cardId: string, patch: Partial<JobReelCard>) => {
    setState((prev) => ({
      ...prev,
      cards: prev.cards.map((card) => (card.id === cardId ? { ...card, ...patch } : card)),
    }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, step }));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const startNew = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // best effort
    }
    setState(createEmptyJobReelState());
  }, []);

  const cardCount = usableCards(state).length;
  const maxReachableStep = !state.backgroundUrl ? 1 : cardCount === 0 ? 3 : 4;
  const currentStep = Math.min(state.step, maxReachableStep);
  const hasContent = Boolean(state.backgroundUrl);

  if (!hydrated) {
    // One paint without the draft would flash step 1 — wait for localStorage
    return <div className="max-w-lg mx-auto px-4 pb-16" />;
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
            {state.hook.headline.trim() || 'Job Reel'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Pinterest background → hook → job cards → one video
          </p>
        </div>
        {hasContent && (
          <button
            type="button"
            onClick={startNew}
            className="flex items-center gap-1 text-xs text-gray-300 border border-gray-700 rounded-lg px-3 py-2 hover:bg-gray-900 flex-shrink-0 min-h-[40px] touch-manipulation"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((step, index) => {
          const isActive = step.number === currentStep;
          const isReachable = step.number <= maxReachableStep;
          const isDone = step.number < currentStep;
          return (
            <div key={step.number} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                disabled={!isReachable}
                onClick={() => goToStep(step.number)}
                className={`flex flex-col items-center gap-1 touch-manipulation ${
                  isReachable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isActive
                      ? 'bg-[#D1FE17] text-black'
                      : isDone
                        ? 'bg-[#D1FE17]/20 text-[#D1FE17] border border-[#D1FE17]/50'
                        : 'bg-gray-900 text-gray-400 border border-gray-700'
                  }`}
                >
                  {step.number}
                </span>
                <span
                  className={`text-[10px] font-medium ${isActive ? 'text-[#D1FE17]' : 'text-gray-500'}`}
                >
                  {step.label}
                </span>
              </button>
              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px mx-1 mb-4 ${
                    step.number < currentStep ? 'bg-[#D1FE17]/50' : 'bg-gray-800'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Steps */}
      {currentStep === 1 && (
        <BackgroundStep state={state} updateState={updateState} goToStep={goToStep} />
      )}
      {currentStep === 2 && (
        <HookStep state={state} updateHook={updateHook} goToStep={goToStep} />
      )}
      {currentStep === 3 && (
        <JobCardsStep
          state={state}
          updateState={updateState}
          updateCard={updateCard}
          goToStep={goToStep}
        />
      )}
      {currentStep === 4 && (
        <RenderStep state={state} updateState={updateState} goToStep={goToStep} />
      )}
    </div>
  );
}
