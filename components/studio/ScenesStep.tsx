'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, MessageCircle, Trash2 } from 'lucide-react';
import type { StudioScene, StudioState } from '@/lib/studio';

interface ScenesStepProps {
  state: StudioState;
  updateState: (patch: Partial<StudioState>) => void;
  updateScene: (sceneId: string, patch: Partial<StudioScene>) => void;
  goToStep: (step: number) => void;
}

export default function ScenesStep({ state, updateState, updateScene, goToStep }: ScenesStepProps) {
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);

  const handleDelete = (sceneId: string) => {
    if (state.scenes.length <= 1) return;
    if (!window.confirm('Delete this scene?')) return;
    updateState({ scenes: state.scenes.filter((scene) => scene.id !== sceneId) });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        AI ungaloda script ah {state.scenes.length} scene{state.scenes.length === 1 ? '' : 's'} ah
        break pannirukku. Check pannunga, thevaina edit pannunga.
      </p>

      {state.scenes.map((scene, index) => {
        const isExpanded = expandedSceneId === scene.id;
        return (
          <div key={scene.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-full bg-[#D1FE17]/15 text-[#D1FE17] text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {index + 1}
                </span>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Scene {index + 1}
                </span>
                {scene.dialogue && (
                  <span className="flex items-center gap-1 text-[10px] text-[#D1FE17] bg-[#D1FE17]/10 rounded-full px-2 py-0.5">
                    <MessageCircle className="w-3 h-3" />
                    Dialogue
                  </span>
                )}
              </div>
              {state.scenes.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDelete(scene.id)}
                  className="text-gray-500 hover:text-red-400 p-1 touch-manipulation"
                  aria-label="Delete scene"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="px-4 pb-3 space-y-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Scene (Tanglish)</label>
                <textarea
                  value={scene.summary}
                  onChange={(e) => updateScene(scene.id, { summary: e.target.value })}
                  rows={2}
                  className="input-field text-sm py-2"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-500 mb-1">
                  Dialogue (Tamil) — video la pesura line
                </label>
                <textarea
                  value={scene.dialogue ?? ''}
                  onChange={(e) =>
                    updateScene(scene.id, { dialogue: e.target.value.trim() ? e.target.value : null })
                  }
                  rows={1}
                  placeholder="No dialogue in this scene"
                  className="input-field text-sm py-2"
                />
              </div>

              <button
                type="button"
                onClick={() => setExpandedSceneId(isExpanded ? null : scene.id)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 touch-manipulation"
              >
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {isExpanded ? 'Hide AI prompts' : 'Edit AI prompts (advanced)'}
              </button>

              {isExpanded && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">
                      Scene image prompt (English)
                    </label>
                    <textarea
                      value={scene.imagePrompt}
                      onChange={(e) => updateScene(scene.id, { imagePrompt: e.target.value })}
                      rows={4}
                      className="input-field text-xs py-2 leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">
                      Motion / camera prompt (English)
                    </label>
                    <textarea
                      value={scene.videoPrompt}
                      onChange={(e) => updateScene(scene.id, { videoPrompt: e.target.value })}
                      rows={4}
                      className="input-field text-xs py-2 leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => goToStep(1)}
          className="btn-secondary flex-1 min-h-[48px] touch-manipulation"
        >
          ← Script
        </button>
        <button
          type="button"
          onClick={() => goToStep(3)}
          className="btn-primary flex-[2] min-h-[48px] touch-manipulation"
        >
          Next: Reference photo →
        </button>
      </div>
    </div>
  );
}
