'use client';

/**
 * Background asset library — every Pinterest background ever resolved is
 * stored on the ThinkPad (tower asset API, `job-reel/library/` prefix) and
 * indexed here in localStorage so it can be reused across reels. This is the
 * content asset library going forward (Ashok's direction).
 */

export interface LibraryAsset {
  url: string;
  type: 'video' | 'image';
  addedAt: string;
  /** Where it came from — shown as a hint in the picker. */
  sourceUrl?: string;
}

const STORAGE_KEY = 'jobReelAssetLibrary_v1';
const MAX_ASSETS = 60;

export function listLibraryAssets(): LibraryAsset[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (asset): asset is LibraryAsset =>
        typeof asset?.url === 'string' && (asset?.type === 'video' || asset?.type === 'image')
    );
  } catch {
    return [];
  }
}

export function addLibraryAsset(asset: Omit<LibraryAsset, 'addedAt'>): LibraryAsset[] {
  const existing = listLibraryAssets().filter((entry) => entry.url !== asset.url);
  const next = [{ ...asset, addedAt: new Date().toISOString() }, ...existing].slice(0, MAX_ASSETS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage full — the library is a convenience, never fatal
  }
  return next;
}

export function removeLibraryAsset(url: string): LibraryAsset[] {
  const next = listLibraryAssets().filter((entry) => entry.url !== url);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
