'use client';

export const SEEDANCE_MIN_DURATION = 3;
export const SEEDANCE_MAX_DURATION = 15;

export function clampVideoDuration(value: unknown, fallback = 12): number {
  const n = typeof value === 'number' ? Math.round(value) : fallback;
  return Math.min(Math.max(n, SEEDANCE_MIN_DURATION), SEEDANCE_MAX_DURATION);
}

interface Props {
  value: number;
  onChange: (seconds: number) => void;
  className?: string;
}

export default function DurationSelect({ value, onChange, className = '' }: Props) {
  const clamped = clampVideoDuration(value);
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-gray-500 font-medium">Duration</p>
        <span className="text-xs font-semibold text-[#D1FE17]">{clamped}s</span>
      </div>
      <input
        type="range"
        min={SEEDANCE_MIN_DURATION}
        max={SEEDANCE_MAX_DURATION}
        step={1}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:w-4
                   [&::-webkit-slider-thumb]:h-4
                   [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-[#D1FE17]
                   [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(209,254,23,0.5)]
                   [&::-moz-range-thumb]:w-4
                   [&::-moz-range-thumb]:h-4
                   [&::-moz-range-thumb]:rounded-full
                   [&::-moz-range-thumb]:bg-[#D1FE17]
                   [&::-moz-range-thumb]:border-0"
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-gray-700">{SEEDANCE_MIN_DURATION}s</span>
        <span className="text-[9px] text-gray-700">{SEEDANCE_MAX_DURATION}s</span>
      </div>
    </div>
  );
}
