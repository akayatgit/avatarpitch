/**
 * Local-disk file storage — replaces Supabase Storage per Ashok's ruling.
 *
 * Files live under STORAGE_DIR (default /srv/avatarpitch/uploads) and are
 * served by this app at /uploads/<path> (see app/uploads/[...path]/route.ts).
 * Public URLs are relative by default so they work identically over LAN,
 * the Cloudflare tunnel hostname, and localhost. Set PUBLIC_STORAGE_BASE_URL
 * (e.g. https://avatarpitch.jobmaster.agency) only when absolute URLs are
 * required — external AI services (Replicate) must be able to fetch them.
 *
 * Garbage collection (Ashok's ruling): every file is deleted 48 hours after
 * creation, except files referenced by a render currently in progress.
 * The Watch Tower runs an independent 72h systemd safety-net sweep.
 */

import { randomUUID } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { join, normalize, resolve, sep } from 'path';
import { localDb } from '@/lib/localDb';

/** Kept for backwards compatibility with older imports. */
export const UPLOADS_BUCKET = 'uploads';

export const UPLOAD_TTL_HOURS = Number(process.env.UPLOAD_TTL_HOURS || 48);

let resolvedStorageDir: string | null = null;

export function getStorageDir(): string {
  if (!resolvedStorageDir) {
    resolvedStorageDir = process.env.STORAGE_DIR || '/srv/avatarpitch/uploads';
  }
  return resolvedStorageDir;
}

async function ensureStorageDir(): Promise<string> {
  const primary = getStorageDir();
  try {
    await mkdir(primary, { recursive: true });
    return primary;
  } catch {
    // Dev machines without /srv — fall back to a local data dir
    const fallback = join(process.cwd(), '.data', 'uploads');
    await mkdir(fallback, { recursive: true });
    resolvedStorageDir = fallback;
    return fallback;
  }
}

/** Kept for backwards compatibility — ensures the storage directory exists. */
export async function ensureUploadsBucket(): Promise<void> {
  await ensureStorageDir();
}

function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'file';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return cleaned.slice(0, 80) || 'file';
}

/**
 * Build a collision-safe object path under the storage dir.
 * Example: job-reel/2026/uuid-background.mp4
 */
export function buildUploadPath(folder: string, fileName: string): string {
  const year = new Date().getUTCFullYear();
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '') || 'misc';
  return `${safeFolder}/${year}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

function publicUrlFor(path: string): string {
  const base = (process.env.PUBLIC_STORAGE_BASE_URL || '').replace(/\/+$/, '');
  return `${base}/uploads/${path}`;
}

/** Safe-join an object path under the storage dir (rejects traversal). */
function storageFilePath(objectPath: string): string | null {
  const dir = getStorageDir();
  const target = resolve(dir, normalize(objectPath).replace(/^([/\\])+/, ''));
  if (target !== dir && !target.startsWith(dir + sep)) return null;
  return target;
}

export interface UploadPublicFileOptions {
  /** Object path inside storage (use buildUploadPath). */
  path: string;
  body: Buffer | Blob | ArrayBuffer | File | string;
  contentType?: string;
  /** Overwrite if the path already exists. Default false (ignored — writes always overwrite). */
  upsert?: boolean;
}

async function toBuffer(body: UploadPublicFileOptions['body']): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body);
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  // Blob / File
  return Buffer.from(await (body as Blob).arrayBuffer());
}

/**
 * Write a file to local storage and return its public URL (/uploads/<path>).
 */
export async function uploadPublicFile(options: UploadPublicFileOptions): Promise<string> {
  await ensureStorageDir();
  const filePath = storageFilePath(options.path);
  if (!filePath) {
    throw new Error(`Invalid storage path: ${options.path}`);
  }
  await mkdir(join(filePath, '..'), { recursive: true });
  await writeFile(filePath, await toBuffer(options.body));

  // Opportunistic GC — cheap, throttled internally
  void sweepExpiredUploads().catch(() => {});

  return publicUrlFor(options.path);
}

/**
 * Download a remote file (e.g. a short-lived Replicate output or a LinkedIn
 * logo) and re-host it in local storage. Returns the original URL if the
 * copy fails.
 */
export async function persistRemoteFileToStorage(
  remoteUrl: string,
  options: { folder: string; fileName: string; contentType?: string }
): Promise<string> {
  try {
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      console.error(`Failed to download remote file (${response.status}): ${remoteUrl}`);
      return remoteUrl;
    }
    const arrayBuffer = await response.arrayBuffer();
    const path = buildUploadPath(options.folder, options.fileName);
    return await uploadPublicFile({ path, body: Buffer.from(arrayBuffer) });
  } catch (error) {
    console.error('Failed to persist remote file to local storage:', error);
    return remoteUrl;
  }
}

/* ------------------------------------------------------------------ */
/* Local URL helpers (used by ffmpeg routes + the /uploads server)      */
/* ------------------------------------------------------------------ */

/** Extract the object path from a local upload URL (relative or absolute). */
export function uploadObjectPathFromUrl(url: string): string | null {
  const match = url.match(/\/uploads\/(.+?)(?:[?#]|$)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Absolute filesystem path for a local upload URL, or null if not local. */
export function localUploadFilePath(url: string): string | null {
  const objectPath = uploadObjectPathFromUrl(url);
  if (!objectPath) return null;
  const filePath = storageFilePath(objectPath);
  if (!filePath || !existsSync(filePath)) return null;
  return filePath;
}

/** Read a locally stored upload by its public URL. */
export async function readLocalUpload(url: string): Promise<Buffer | null> {
  const filePath = localUploadFilePath(url);
  if (!filePath) return null;
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

export function createLocalUploadStream(filePath: string, start?: number, end?: number) {
  return createReadStream(filePath, start != null && end != null ? { start, end } : undefined);
}

/* ------------------------------------------------------------------ */
/* 48-hour garbage collection                                          */
/* ------------------------------------------------------------------ */

let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // at most once an hour

/** URLs referenced by renders currently in flight must survive the sweep. */
async function collectRenderingReferences(): Promise<Set<string>> {
  const protectedPaths = new Set<string>();
  try {
    const { data } = await localDb
      .from('content_creation_requests')
      .select('generated_output')
      .eq('status', 'processing');
    for (const row of (data as Array<{ generated_output: unknown }>) ?? []) {
      const serialized = JSON.stringify(row.generated_output ?? {});
      const matches = serialized.match(/\/uploads\/[^"\\]+/g) ?? [];
      for (const match of matches) {
        const objectPath = uploadObjectPathFromUrl(match);
        if (objectPath) protectedPaths.add(objectPath);
      }
    }
  } catch (error) {
    console.error('GC: could not collect in-progress render references:', error);
  }
  return protectedPaths;
}

async function walkFiles(dir: string, base = ''): Promise<Array<{ objectPath: string; filePath: string }>> {
  const out: Array<{ objectPath: string; filePath: string }> = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const filePath = join(dir, entry.name);
    const objectPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(filePath, objectPath)));
    } else if (entry.isFile()) {
      out.push({ objectPath, filePath });
    }
  }
  return out;
}

/**
 * Delete uploads older than UPLOAD_TTL_HOURS (48h per ruling), sparing files
 * referenced by an in-progress render. Throttled to once per hour; the tower's
 * 72h systemd timer is the independent safety net.
 */
export async function sweepExpiredUploads(options?: { force?: boolean }): Promise<number> {
  const now = Date.now();
  if (!options?.force && now - lastSweepAt < SWEEP_INTERVAL_MS) return 0;
  lastSweepAt = now;

  const dir = await ensureStorageDir();
  const cutoff = now - UPLOAD_TTL_HOURS * 60 * 60 * 1000;
  const protectedPaths = await collectRenderingReferences();

  let deleted = 0;
  for (const file of await walkFiles(dir)) {
    if (protectedPaths.has(file.objectPath)) continue;
    try {
      const info = await stat(file.filePath);
      if (info.mtimeMs < cutoff) {
        await unlink(file.filePath);
        deleted++;
      }
    } catch {
      // File may already be gone — fine
    }
  }
  if (deleted > 0) {
    console.log(`GC: removed ${deleted} upload(s) older than ${UPLOAD_TTL_HOURS}h`);
  }
  return deleted;
}
