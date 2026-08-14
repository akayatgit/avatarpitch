/**
 * ThinkPad-backed asset storage via the Watch Tower partner API (Ashok's ruling:
 * AvatarPitch stays on Vercel and pays for no storage — all files live on the
 * ThinkPad, uploaded/fetched through the tower's API over the tunnel).
 *
 * Contract (see documents/tower-asset-api-request.md):
 *   PUT /api/partner/v1/assets/{key}   — bearer token, raw body      (write)
 *   GET /api/partner/v1/assets/{key}   — public, Range support       (read)
 * Keys carry client-generated random parts, so public reads are unguessable.
 *
 * Every function degrades gracefully while the tower hasn't enabled the
 * endpoints yet (404/503) — callers fall back to CDN URLs / inline videos.
 */

const DEFAULT_BASE_URL = 'https://tower.jobmaster.agency/api/partner/v1';
const UPLOAD_TIMEOUT_MS = 120_000;

function towerBaseUrl(): string {
  return (process.env.TOWER_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

/** Public read URL for an asset key (no token — browser <video> friendly). */
export function towerAssetUrl(key: string): string {
  return `${towerBaseUrl()}/assets/${key}`;
}

/** True when a URL points at the tower's public asset endpoint (and nowhere else). */
export function isTowerAssetHttpUrl(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith(`${towerBaseUrl()}/assets/`);
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]{2,180}$/;

export function isValidAssetKey(key: unknown): key is string {
  return typeof key === 'string' && SAFE_KEY.test(key) && !key.includes('..');
}

/**
 * Upload a file to the ThinkPad through the tower API. Returns the public URL,
 * or null when tower storage isn't available yet (endpoint missing, token
 * unset tower-side, tower down) — callers must fall back gracefully.
 */
export async function putTowerAsset(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string | null> {
  const token = process.env.PARTNER_API_TOKEN;
  if (!token || !isValidAssetKey(key)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(towerAssetUrl(key), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType || 'application/octet-stream',
      },
      body: new Uint8Array(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`Tower asset upload failed (${response.status}) for ${key}`);
      return null;
    }
    const data = await response.json().catch(() => null);
    return typeof data?.url === 'string' ? data.url : towerAssetUrl(key);
  } catch (error) {
    console.error('Tower asset upload error:', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface RenderStatusDoc {
  status: 'rendering' | 'completed' | 'failed';
  finalVideoUrl?: string | null;
  error?: string | null;
  updatedAt: string;
}

const statusKey = (ticket: string) => `job-reel/status/${ticket}.json`;

/** Tickets are client-generated; keep the asset key safe and predictable. */
export function isValidTicket(ticket: unknown): ticket is string {
  return typeof ticket === 'string' && /^[a-z0-9-]{8,80}$/.test(ticket);
}

/** Best-effort — a render must never fail because a status write failed. */
export async function writeRenderStatus(ticket: string, doc: Omit<RenderStatusDoc, 'updatedAt'>) {
  await putTowerAsset(
    statusKey(ticket),
    Buffer.from(JSON.stringify({ ...doc, updatedAt: new Date().toISOString() })),
    'application/json'
  );
}

export async function readRenderStatus(ticket: string): Promise<RenderStatusDoc | null> {
  try {
    const response = await fetch(towerAssetUrl(statusKey(ticket)), { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as RenderStatusDoc;
  } catch {
    return null;
  }
}
