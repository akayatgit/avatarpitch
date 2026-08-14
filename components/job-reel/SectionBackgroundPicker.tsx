'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Film, Loader2, Trash2 } from 'lucide-react';
import {
  addLibraryAsset,
  listLibraryAssets,
  removeLibraryAsset,
  type LibraryAsset,
} from '@/lib/assetLibrary';

interface SectionBackgroundPickerProps {
  /** Current per-section override (null = use the default background). */
  currentUrl: string | null;
  currentType: 'video' | 'image' | null;
  onChange: (background: { url: string; type: 'video' | 'image' } | null) => void;
}

/**
 * Per-section background control: keep the default, pick from the asset
 * library (every background ever fetched), or paste a new Pinterest link —
 * which also lands in the library for future reels.
 */
export default function SectionBackgroundPicker({
  currentUrl,
  currentType,
  onChange,
}: SectionBackgroundPickerProps) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [pinUrl, setPinUrl] = useState('');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setAssets(listLibraryAssets());
  }, [open]);

  const resolvePin = async () => {
    const trimmed = pinUrl.trim();
    if (!trimmed) return;
    setResolving(true);
    setError(null);
    try {
      const response = await fetch('/api/job-reel/resolve-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await response.json();
      if (!response.ok || !data?.backgroundUrl) {
        throw new Error(data?.error || 'Could not download that background');
      }
      const type: 'video' | 'image' = data.backgroundType === 'image' ? 'image' : 'video';
      setAssets(addLibraryAsset({ url: data.backgroundUrl, type, sourceUrl: trimmed }));
      onChange({ url: data.backgroundUrl, type });
      setPinUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download that background');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left touch-manipulation"
      >
        <Film className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        <span className="text-[11px] text-gray-400 flex-1 truncate">
          Background: {currentUrl ? 'custom for this section' : 'default'}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5">
          {/* Library strip */}
          {assets.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                type="button"
                onClick={() => onChange(null)}
                className={`flex-shrink-0 w-14 aspect-[9/16] rounded-lg border text-[9px] text-gray-300 flex items-center justify-center text-center leading-tight touch-manipulation ${
                  !currentUrl ? 'border-[#D1FE17] bg-[#D1FE17]/10' : 'border-gray-700 bg-black/40'
                }`}
              >
                Use default
              </button>
              {assets.map((asset) => {
                const selected = currentUrl === asset.url;
                return (
                  <div key={asset.url} className="relative flex-shrink-0 group">
                    <button
                      type="button"
                      onClick={() => onChange({ url: asset.url, type: asset.type })}
                      className={`w-14 aspect-[9/16] rounded-lg overflow-hidden border bg-black touch-manipulation ${
                        selected ? 'border-[#D1FE17]' : 'border-gray-700'
                      }`}
                    >
                      {asset.type === 'video' ? (
                        <video
                          src={asset.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={asset.url} alt="" className="w-full h-full object-cover" />
                      )}
                    </button>
                    {selected && (
                      <span className="absolute top-0.5 right-0.5 bg-[#D1FE17] rounded-full p-0.5">
                        <Check className="w-2.5 h-2.5 text-black" />
                      </span>
                    )}
                    {!selected && (
                      <button
                        type="button"
                        onClick={() => setAssets(removeLibraryAsset(asset.url))}
                        title="Remove from library"
                        className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-1 opacity-0 group-hover:opacity-100 touch-manipulation"
                      >
                        <Trash2 className="w-2.5 h-2.5 text-gray-300" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* New pin for this section */}
          <div className="flex gap-2">
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              value={pinUrl}
              onChange={(e) => setPinUrl(e.target.value)}
              placeholder="Pinterest link for this section…"
              className="input-field text-xs flex-1 min-h-[40px]"
            />
            <button
              type="button"
              onClick={() => void resolvePin()}
              disabled={resolving || !pinUrl.trim()}
              className="btn-secondary text-xs px-3 min-h-[40px] disabled:opacity-40 touch-manipulation"
            >
              {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Fetch'}
            </button>
          </div>
          {error && (
            <p className="text-[11px] text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-2.5 py-1.5">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
