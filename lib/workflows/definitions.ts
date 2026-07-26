import type { WorkflowDefinition } from './types';

/**
 * Client-safe workflow metadata only — no server tools / sharp / replicate imports.
 */
export const DRONE_TRACING_SHOT: WorkflowDefinition = {
  id: 'drone-tracing-shot',
  name: 'Drone Tracing Shot',
  description:
    'Surreal tech FPV: pick a style, invent a vast chip/landscape world, draw the flight path, generate the flythrough.',
  defaultDuration: 15,
  steps: [
    { id: 'surreal-ideation', label: 'Style & Idea', tool: 'suggestFootage' },
    { id: 'generate-image', label: 'Aerial Still', tool: 'generateImage' },
    { id: 'draw-path', label: 'Draw Path', tool: 'PathDrawingCanvas' },
    { id: 'analyze-path', label: 'Trace Path', tool: 'analyzePath' },
    { id: 'assemble-prompt', label: 'Prompt', tool: 'assemblePrompt' },
    { id: 'generate-video', label: 'Video', tool: 'generateVideo' },
  ],
};

export const CONTINUOUS_SHOT_PATH: WorkflowDefinition = {
  id: 'continuous-shot-path',
  name: 'Continuous Shot with Path',
  description:
    'Surreal tech continuous take: style + idea, scene + object, draw the track, generate timed beats.',
  defaultDuration: 12,
  steps: [
    { id: 'surreal-ideation', label: 'Style & Idea', tool: 'suggestFootage' },
    { id: 'collect-inputs', label: 'Scene & Object', tool: 'inputs' },
    { id: 'draw-path', label: 'Draw Path', tool: 'PathDrawingCanvas' },
    { id: 'analyze-path', label: 'Trace Path', tool: 'analyzePath' },
    { id: 'assemble-prompt', label: 'Prompt', tool: 'assemblePrompt' },
    { id: 'generate-video', label: 'Video', tool: 'generateVideo' },
  ],
};
