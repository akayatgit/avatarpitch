import { CONTINUOUS_SHOT_PATH, DRONE_TRACING_SHOT } from './definitions';
import type { WorkflowDefinition, WorkflowId } from './types';

/** All Master-Prompt workflows the avatar can pick. */
export const WORKFLOWS: WorkflowDefinition[] = [
  DRONE_TRACING_SHOT,
  CONTINUOUS_SHOT_PATH,
];

export function getWorkflow(id: WorkflowId): WorkflowDefinition | undefined {
  return WORKFLOWS.find((w) => w.id === id);
}

export function listWorkflows(): WorkflowDefinition[] {
  return WORKFLOWS;
}
