'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import {
  createEmptyAssemblyState,
  type AssemblyBuilding,
  type AssemblyState,
} from '@/lib/assembly';
import BuildingsStep from './BuildingsStep';
import EmptyPlotStep from './EmptyPlotStep';
import RevealVideoStep from './RevealVideoStep';

export interface RecentAssemblyProject {
  id: string;
  title: string;
  createdAt: string;
  buildingCount: number;
  hasVideo: boolean;
}

interface AssemblyWizardProps {
  initialProjectId: string | null;
  initialState: AssemblyState | null;
  recentProjects: RecentAssemblyProject[];
}

const STEPS = [
  { number: 1, label: 'Buildings' },
  { number: 2, label: 'Empty plot' },
  { number: 3, label: 'Reveal video' },
];

export default function AssemblyWizard({
  initialProjectId,
  initialState,
  recentProjects,
}: AssemblyWizardProps) {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [state, setState] = useState<AssemblyState>(initialState ?? createEmptyAssemblyState());
  const [saving, setSaving] = useState(false);

  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const stateRef = useRef(state);
  stateRef.current = state;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  const persistNow = useCallback(async () => {
    const currentState = stateRef.current;
    // Nothing worth saving until at least one reference image exists
    if (!currentState.buildings.some((building) => building.originalImageUrl)) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/assembly/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectIdRef.current, state: currentState }),
      });
      const data = await response.json();
      if (response.ok && data?.projectId && !projectIdRef.current) {
        setProjectId(data.projectId);
        // Keep the URL shareable / refresh-safe without a navigation
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', `/app/assembly?projectId=${data.projectId}`);
        }
      }
    } catch (error) {
      console.error('Autosave failed:', error);
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

  const updateState = useCallback((patch: Partial<AssemblyState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateBuilding = useCallback((buildingId: string, patch: Partial<AssemblyBuilding>) => {
    setState((prev) => ({
      ...prev,
      buildings: prev.buildings.map((building) =>
        building.id === buildingId ? { ...building, ...patch } : building
      ),
    }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, step }));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const readyBuildings = state.buildings.filter((building) => building.originalImageUrl);
  const maxReachableStep =
    readyBuildings.length === 0
      ? 1
      : readyBuildings.some((building) => building.emptyPlotUrl)
        ? 3
        : 2;
  const currentStep = Math.min(state.step, maxReachableStep);
  const isFreshProject = !projectId && readyBuildings.length === 0;

  return (
    <div className="max-w-lg mx-auto px-4 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
            {state.title || 'Building Assembly'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Empty plot → construction reveal video
            {saving && <span className="ml-2 text-gray-500">Saving…</span>}
          </p>
        </div>
        {projectId && (
          <Link
            href="/app/assembly"
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
        <BuildingsStep
          state={state}
          updateState={updateState}
          updateBuilding={updateBuilding}
          goToStep={goToStep}
        />
      )}
      {currentStep === 2 && (
        <EmptyPlotStep state={state} updateBuilding={updateBuilding} goToStep={goToStep} />
      )}
      {currentStep === 3 && (
        <RevealVideoStep
          state={state}
          projectId={projectId}
          updateBuilding={updateBuilding}
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
                href={`/app/assembly?projectId=${project.id}`}
                className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-600 transition-colors touch-manipulation"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {project.title || 'Untitled assembly'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {project.buildingCount} building{project.buildingCount === 1 ? '' : 's'}
                    {project.hasVideo ? ' · video ready' : ''}
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
