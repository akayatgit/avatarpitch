import {
  assembleContinuousShotPrompt,
  type ContinuousAssembleInputs,
} from './continuous-shot-path';
import {
  assembleDroneTracingPrompt,
  type DroneAssembleInputs,
} from './drone-tracing-shot';
import type { AssemblePromptResult, WorkflowId } from './types';

export type AssemblePromptRequest =
  | { workflowId: 'drone-tracing-shot'; inputs: DroneAssembleInputs }
  | { workflowId: 'continuous-shot-path'; inputs: ContinuousAssembleInputs };

/**
 * Shared assemble-prompt tool dispatcher.
 * Each workflow owns its Master Prompt Book shape; APIs never duplicate this.
 */
export async function assemblePrompt(
  workflowId: WorkflowId,
  inputs: Record<string, unknown>
): Promise<AssemblePromptResult> {
  if (workflowId === 'drone-tracing-shot') {
    const locationDescription = String(inputs.locationDescription ?? '');
    const annotatedImage = String(inputs.annotatedImage ?? '');
    if (!locationDescription.trim() || !annotatedImage) {
      throw new Error('locationDescription and annotatedImage are required');
    }
    return assembleDroneTracingPrompt({
      locationDescription,
      duration: typeof inputs.duration === 'number' ? inputs.duration : undefined,
      segmentCount: typeof inputs.segmentCount === 'number' ? inputs.segmentCount : undefined,
      annotatedImage,
      inspirationImageUrl:
        typeof inputs.inspirationImageUrl === 'string' ? inputs.inspirationImageUrl : undefined,
      inspirationRead:
        typeof inputs.inspirationRead === 'string' ? inputs.inspirationRead : undefined,
      topic: typeof inputs.topic === 'string' ? inputs.topic : undefined,
      motionHint: typeof inputs.motionHint === 'string' ? inputs.motionHint : undefined,
    });
  }

  if (workflowId === 'continuous-shot-path') {
    const sceneDescription = String(inputs.sceneDescription ?? '');
    const annotatedImage = String(inputs.annotatedImage ?? '');
    const objectImage = String(inputs.objectImage ?? '');
    if (!sceneDescription.trim() || !annotatedImage || !objectImage) {
      throw new Error('sceneDescription, annotatedImage, and objectImage are required');
    }
    return assembleContinuousShotPrompt({
      sceneDescription,
      objectDescription:
        typeof inputs.objectDescription === 'string' ? inputs.objectDescription : undefined,
      annotatedImage,
      objectImage,
      duration: typeof inputs.duration === 'number' ? inputs.duration : 12,
      inspirationImageUrl:
        typeof inputs.inspirationImageUrl === 'string' ? inputs.inspirationImageUrl : undefined,
      inspirationRead:
        typeof inputs.inspirationRead === 'string' ? inputs.inspirationRead : undefined,
      topic: typeof inputs.topic === 'string' ? inputs.topic : undefined,
      motionHint: typeof inputs.motionHint === 'string' ? inputs.motionHint : undefined,
    });
  }

  throw new Error(`Unknown workflowId: ${workflowId}`);
}
