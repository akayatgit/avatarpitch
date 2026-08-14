'use client';

import { useEffect, useState } from 'react';
import { Loader2, RadioTower, Sparkles } from 'lucide-react';
import type { JobReelCard } from '@/lib/jobReel';

interface TowerSuggestion {
  skill: string;
  active_jobs: number;
  companies_with_logo: number;
}

interface TowerHealth {
  ok: boolean;
  jobs_total: number;
  freshest_scrape_at: string;
}

export interface TowerCardData
  extends Pick<JobReelCard, 'company' | 'logoUrl' | 'role' | 'experience' | 'education'> {
  towerJobId: string;
}

interface TowerFillPanelProps {
  onFill: (cards: TowerCardData[]) => void;
  maxCards: number;
}

const EXPERIENCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'fresher', label: 'Fresher (0-2 yrs)' },
  { value: '1-2', label: '1-2 yrs' },
  { value: '3-5', label: '3-5 yrs' },
  { value: '6-8', label: '6-8 yrs' },
  { value: '9-12', label: '9-12 yrs' },
  { value: '13plus', label: '13+ yrs' },
];

/**
 * Auto-fill job cards from the Watch Tower jobs database (partner API).
 * Cards are filled verbatim from tower rows — no invented job facts.
 */
export default function TowerFillPanel({ onFill, maxCards }: TowerFillPanelProps) {
  const [suggestions, setSuggestions] = useState<TowerSuggestion[]>([]);
  const [health, setHealth] = useState<TowerHealth | null>(null);
  const [towerOffline, setTowerOffline] = useState(false);
  const [skill, setSkill] = useState('');
  const [experience, setExperience] = useState('fresher');
  const [count, setCount] = useState(6);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/job-reel/tower-suggestions', { cache: 'no-store' });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setTowerOffline(true);
          return;
        }
        setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
        if (data?.health) setHealth(data.health);
      } catch {
        if (!cancelled) setTowerOffline(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchJobs = async () => {
    setFetching(true);
    setError(null);
    setLastResult(null);
    try {
      const params = new URLSearchParams();
      if (skill.trim()) params.set('skill', skill.trim());
      params.set('experience', experience);
      params.set('limit', String(Math.min(count, maxCards)));
      const response = await fetch(`/api/job-reel/tower-jobs?${params}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data?.cards)) {
        throw new Error(data?.error || 'Could not fetch jobs from the Watch Tower');
      }
      if (data.cards.length === 0) {
        setLastResult('No fresh jobs matched — try another skill or a wider experience band.');
        return;
      }
      onFill(data.cards as TowerCardData[]);
      setLastResult(
        `Filled ${data.cards.length} card${data.cards.length === 1 ? '' : 's'} (${data.totalMatched} matched)`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch jobs from the Watch Tower');
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-[#D1FE17]/25 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <RadioTower className="w-4 h-4 text-[#D1FE17]" />
        <p className="text-sm text-white font-medium flex-1">Auto-fill from Watch Tower</p>
        {health && (
          <span className="text-[10px] text-gray-500">
            {health.jobs_total.toLocaleString()} jobs live
          </span>
        )}
      </div>

      {towerOffline ? (
        <p className="text-xs text-gray-500">
          Watch Tower API not reachable right now — you can still fill cards by hand, or try
          again in a minute (the tower may be deploying).
        </p>
      ) : (
        <>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.slice(0, 8).map((suggestion) => (
                <button
                  key={suggestion.skill}
                  type="button"
                  onClick={() => setSkill(suggestion.skill)}
                  className={`text-[11px] rounded-full px-3 py-1.5 border transition-colors touch-manipulation ${
                    skill === suggestion.skill
                      ? 'border-[#D1FE17] bg-[#D1FE17]/10 text-[#D1FE17]'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {suggestion.skill} · {suggestion.active_jobs}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              placeholder="Skill (e.g. sql)"
              className="input-field text-sm min-h-[44px] flex-1"
            />
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="input-field text-sm min-h-[44px] w-[130px]"
            >
              {EXPERIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 flex-1">Cards to fetch</label>
            <input
              type="number"
              min={1}
              max={maxCards}
              value={count}
              onChange={(e) =>
                setCount(Math.min(maxCards, Math.max(1, Number(e.target.value) || 1)))
              }
              className="input-field text-sm min-h-[44px] w-[70px] text-center"
            />
          </div>

          <button
            type="button"
            onClick={fetchJobs}
            disabled={fetching}
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2.5 min-h-[48px] disabled:opacity-40 touch-manipulation"
          >
            {fetching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {fetching ? 'Fetching fresh jobs…' : 'Fill cards from live jobs'}
          </button>

          {lastResult && <p className="text-xs text-gray-400">{lastResult}</p>}
          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
