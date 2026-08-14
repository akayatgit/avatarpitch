'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import {
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

export interface RecentJobReelProject {
  id: string;
  title: string;
  createdAt: string;
  cardCount: number;
  renderStatus: string;
  hasVideo: boolean;
}

interface JobReelWizardProps {
  initialProjectId: string | null;
  initialState: JobReelState | null;
  recentProjects: RecentJobReelProject[];
}

const STEPS = [
  { number: 1, label: 'Background' },
  { number: 2, label: 'Hook' },
  { number: 3, label: 'Job cards' },
  { number: 4, label: 'Video' },
];

export default function JobReelWizard({
  initialProjectId,
  initialState,
  recentProjects,
}: JobReelWizardProps) {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [state, setState] = useState<JobReelState>(initialState ?? createEmptyJobReelState());
  const [saving, setSaving] = useState(false);

  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const stateRef = useRef(state);
  stateRef.current = state;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  /** Persist immediately and resolve with the project id (created on first save). */
  const persistNow = useCallback(async (overrideState?: JobReelState): Promise<string | null> => {
    const currentState = overrideState ?? stateRef.current;
    // Nothing worth saving until a background exists
    if (!currentState.backgroundUrl) {
      return projectIdRef.current;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/job-reel/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectIdRef.current, state: currentState }),
      });
      const data = await response.json();
      if (response.ok && data?.projectId && !projectIdRef.current) {
        setProjectId(data.projectId);
        projectIdRef.current = data.projectId;
        // Keep the URL shareable / refresh-safe without a navigation
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', `/app/job-reel?projectId=${data.projectId}`);
        }
      }
      return projectIdRef.current;
    } catch (error) {
      console.error('Autosave failed:', error);
      return projectIdRef.current;
    } finally {
      setSaving(false);
    }
  }, []);

  // Debounced autosave whenever state changes (skips first render / hydration)
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      void persistNow();
    }, 1200);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [state, persistNow]);

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

  const cardCount = usableCards(state).length;
  const maxReachableStep = !state.backgroundUrl ? 1 : cardCount === 0 ? 3 : 4;
  const currentStep = Math.min(state.step, maxReachableStep);
  const isFreshProject = !projectId && !state.backgroundUrl;

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
            {saving && <span className="ml-2 text-gray-500">Saving…</span>}
          </p>
        </div>
        {projectId && (
          <Link
            href="/app/job-reel"
            className="flex items-center gap-1 text-xs text-gray-300 border border-gray-700 rounded-lg px-3 py-2 hover:bg-gray-900 flex-shrink-0 min-h-[40px] touch-manipulation"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </Link>
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
        <RenderStep
          state={state}
          projectId={projectId}
          updateState={updateState}
          persistNow={persistNow}
          goToStep={goToStep}
        />
      )}

      {/* Recent projects (only on a fresh start) */}
      {isFreshProject && recentProjects.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Continue where you left off</h2>
          <div className="space-y-2">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                href={`/app/job-reel?projectId=${project.id}`}
                className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-600 transition-colors touch-manipulation"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {project.title || 'Untitled job reel'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {project.cardCount} job card{project.cardCount === 1 ? '' : 's'}
                    {project.hasVideo
                      ? ' · video ready'
                      : project.renderStatus === 'rendering'
                        ? ' · rendering…'
                        : ''}
                  </p>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0 ml-3">
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
