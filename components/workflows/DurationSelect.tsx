'use client';

/** Shared Seedance duration picker — model supports 3–15 seconds. */
export const SEEDANCE_MIN_DURATION = 3;
export const SEEDANCE_MAX_DURATION = 15;

export function clampVideoDuration(value: unknown, fallback = 12): number {
  const n = typeof value === 'number' ? Math.round(value) : fallback;
  return Math.min(Math.max(n, SEEDANCE_MIN_DURATION), SEEDANCE_MAX_DURATION);
}

const OPTIONS = Array.from(
  { length: SEEDANCE_MAX_DURATION - SEEDANCE_MIN_DURATION + 1 },
  (_, i) => SEEDANCE_MIN_DURATION + i
);

interface Props {
  value: number;
  onChange: (seconds: number) => void;
  className?: string;
}

export default function DurationSelect({ value, onChange, className = '' }: Props) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-white mb-2">Duration</label>
      <select
        value={clampVideoDuration(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input-field"
      >
        {OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s} seconds
          </option>
        ))}
      </select>
    </div>
  );
}
