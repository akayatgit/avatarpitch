export type WorkflowId = 'drone-tracing-shot' | 'continuous-shot-path';

export type WorkflowStepId =
  | 'surreal-ideation'
  | 'collect-inputs'
  | 'generate-image'
  | 'draw-path'
  | 'analyze-path'
  | 'assemble-prompt'
  | 'generate-video';

export interface WorkflowStepDef {
  id: WorkflowStepId;
  label: string;
  tool: string;
}

export interface WorkflowDefinition {
  id: WorkflowId;
  name: string;
  description: string;
  defaultDuration: number;
  steps: WorkflowStepDef[];
}

export interface AssemblePromptResult {
  prompt: string;
  duration: number;
  pathAnalysis?: string | null;
}
