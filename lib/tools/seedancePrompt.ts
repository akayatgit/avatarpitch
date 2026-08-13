/** Seedance rejects prompts over 4000 chars — keep a buffer under that. */
export const SEEDANCE_PROMPT_MAX_CHARS = 3500;

/** Truncate a prompt to Seedance's safe length (prefer cutting at a paragraph). */
export function clampSeedancePrompt(prompt: string, max = SEEDANCE_PROMPT_MAX_CHARS): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max);
  const breakAt = Math.max(
    slice.lastIndexOf('\n\n'),
    slice.lastIndexOf('\n'),
    slice.lastIndexOf('. ')
  );
  const cut =
    breakAt > max * 0.7 ? slice.slice(0, breakAt + (slice[breakAt] === '.' ? 1 : 0)) : slice;
  console.warn(`Seedance prompt clamped from ${trimmed.length} to ${cut.length} chars`);
  return cut.trim();
}
