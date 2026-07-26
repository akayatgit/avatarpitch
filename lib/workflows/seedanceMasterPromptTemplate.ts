import { clampSeedancePrompt } from '@/lib/tools/seedancePrompt';

/**
 * Strict Seedance FPV master prompt — ONE reference image only.
 * [Image1] = annotated still (clean world + drawn path).
 * Preserve the underlying scene from [Image1]; use the red route as choreography only (never render it).
 */

export function buildSeedanceDroneMasterPrompt(options: {
  durationSeconds: number;
  /** Ordered flight beats — no building-only assumptions */
  flightSequenceBullets: string[];
}): string {
  const duration = Math.min(Math.max(Math.round(options.durationSeconds), 3), 15);
  const bullets = options.flightSequenceBullets
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => (b.startsWith('•') || b.startsWith('-') ? b.replace(/^[-•]\s*/, '• ') : `• ${b}`));

  const flightBlock =
    bullets.length > 0
      ? bullets.join('\n')
      : [
          '• Begin with a low-altitude entry through the foreground of the scene in [Image1].',
          '• Perform a sweeping approach around the foreground subjects while maintaining strong forward momentum.',
          '• Accelerate toward the central subject or focal landmark exactly as the route in [Image1] shows.',
          '• Transition into a smooth climb or orbit while staying close to the primary subject.',
          '• Continue along every curve of the [Image1] route without skipping sections.',
          '• Pass the highest or deepest point of the path without stopping.',
          '• Transition into a wide pullback arc while continuing to move.',
          '• Finish with a dramatic wide reveal matching the end of the drawn route.',
        ].join('\n');

  const prompt = `Use [Image1] as the master visual reference for the entire video. Preserve the exact environment, subjects, materials, spatial layout, skyline or backdrop, object positions, architecture or forms, paths, lighting, atmosphere, colors, perspective, scale, and composition from [Image1]. Do not modify the environment or introduce new major subjects, landmarks, or structures that are not present in [Image1].

The red route lines, arrows, numbered checkpoints, storyboard marks, text, diagrams, graphs, and all UI elements drawn on [Image1] are planning guides ONLY for camera choreography. They must NOT appear in the final video.

Create a hyper-realistic cinematic FPV drone sequence lasting approximately ${duration} seconds.

The entire sequence must be one continuous uninterrupted FPV drone shot from the first frame to the last. There must be no cuts, hidden transitions, camera resets, teleportation, disconnected movements, or abrupt viewpoint changes.

Treat the route shown on [Image1] as a continuous camera spline. Follow the camera path precisely, preserving every curve, banking turn, climb, descent, spiral, pullback, altitude change, and direction exactly as illustrated. Do not simplify the route, skip sections, reinterpret the movement, or create shortcuts. Every segment of the route must connect seamlessly to the next while maintaining realistic FPV drone momentum and continuous spatial orientation.

Match the timing and progression of the drawn route on [Image1].

Flight Sequence

${flightBlock}

Camera Style

Professional FPV drone
First-person perspective
One continuous take
Ultra-high-speed cinematic flight
Physically accurate FPV drone movement
Realistic inertia
Continuous forward momentum
Smooth banking during turns
Natural acceleration and deceleration
Stable horizon
Strong foreground and background parallax
Immersive sense of speed
Continuous spatial continuity

Visual Style

Ultra-photorealistic
Cinematic
HDR
8K quality
Realistic lighting
Natural shadows
Accurate reflections
Atmospheric haze
Highly detailed materials and forms
Physically accurate scale
Premium drone cinematography

Critical Instructions

The drawn route on [Image1] defines the exact camera choreography.
The route line is a continuous camera trajectory, not a loose direction guide.
Follow the route timing and movement exactly.
Maintain one uninterrupted continuous flight.
Preserve the underlying environment and subjects from [Image1] exactly — never show the red path or annotations.

Negative Prompt

Do not render the route lines, arrows, numbered markers, storyboard panels, text, graphs, UI elements, overlays, watermarks, or guide marks. Do not duplicate subjects, distort forms, change the environment from [Image1], introduce AI artifacts, flickering, camera jumps, unrealistic motion, excessive fisheye distortion, or hidden cuts.`;

  return clampSeedancePrompt(prompt);
}
