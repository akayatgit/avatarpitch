import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const UPLOADS_BUCKET = 'uploads';

let bucketReady: Promise<void> | null = null;

/**
 * Ensure the public `uploads` bucket exists. Idempotent — safe to call on every upload.
 */
export async function ensureUploadsBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
      if (listError) {
        // Fall through and try create — list can fail on some projects while create still works
        console.warn('Could not list storage buckets:', listError.message);
      } else if (buckets?.some((bucket: { name: string }) => bucket.name === UPLOADS_BUCKET)) {
        return;
      }

      const { error: createError } = await supabaseAdmin.storage.createBucket(UPLOADS_BUCKET, {
        public: true,
        fileSizeLimit: 50 * 1024 * 1024, // 50 MB
      });

      if (createError) {
        const message = createError.message?.toLowerCase() ?? '';
        // Concurrent first-uploads / already-created via SQL migration
        if (
          message.includes('already exists') ||
          message.includes('duplicate') ||
          (createError as { statusCode?: string }).statusCode === '409'
        ) {
          return;
        }
        // Reset so a later request can retry after a transient failure
        bucketReady = null;
        throw new Error(`Failed to create storage bucket "${UPLOADS_BUCKET}": ${createError.message}`);
      }
    })();
  }

  await bucketReady;
}

function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'file';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return cleaned.slice(0, 80) || 'file';
}

/**
 * Build a collision-safe object path under the uploads bucket.
 * Example: studio/2026/uuid-photo.jpg
 */
export function buildUploadPath(folder: string, fileName: string): string {
  const year = new Date().getUTCFullYear();
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '') || 'misc';
  return `${safeFolder}/${year}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

export interface UploadPublicFileOptions {
  /** Object path inside the bucket (use buildUploadPath). */
  path: string;
  body: Buffer | Blob | ArrayBuffer | File | ReadableStream | string;
  contentType?: string;
  /** Overwrite if the path already exists. Default false. */
  upsert?: boolean;
}

/**
 * Upload a file to the public `uploads` bucket and return its public HTTPS URL.
 */
export async function uploadPublicFile(options: UploadPublicFileOptions): Promise<string> {
  await ensureUploadsBucket();

  const { path, body, contentType, upsert = false } = options;

  const { error } = await supabaseAdmin.storage.from(UPLOADS_BUCKET).upload(path, body, {
    contentType: contentType || 'application/octet-stream',
    upsert,
    cacheControl: '3600',
  });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from(UPLOADS_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error('Supabase Storage upload succeeded but no public URL was returned');
  }

  return data.publicUrl;
}

/**
 * Download a remote file (e.g. a short-lived Replicate output) and re-host it
 * in Supabase Storage. Returns the original URL if the copy fails.
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
    const contentType =
      options.contentType ||
      response.headers.get('content-type') ||
      'application/octet-stream';

    const path = buildUploadPath(options.folder, options.fileName);
    return await uploadPublicFile({
      path,
      body: Buffer.from(arrayBuffer),
      contentType,
    });
  } catch (error) {
    console.error('Failed to persist remote file to Supabase Storage:', error);
    return remoteUrl;
  }
}
