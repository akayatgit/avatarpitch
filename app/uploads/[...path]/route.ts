import { NextRequest } from 'next/server';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import {
  createLocalUploadStream,
  ensureUploadsBucket,
  localUploadFilePath,
  sweepExpiredUploads,
} from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTENT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  json: 'application/json',
};

function contentTypeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Serves the local uploads directory ("AvatarPitch serves its own uploads" —
 * tower contract §2.3). Supports HTTP Range requests so <video> playback and
 * seeking work on iOS Safari.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  await ensureUploadsBucket();
  void sweepExpiredUploads().catch(() => {});

  const objectPath = (params.path ?? []).join('/');
  const filePath = localUploadFilePath(`/uploads/${objectPath}`);
  if (!filePath) {
    return new Response('Not found', { status: 404 });
  }

  const info = await stat(filePath);
  const contentType = contentTypeFor(objectPath);
  const baseHeaders: Record<string, string> = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
  };

  const range = request.headers.get('range');
  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? Math.min(parseInt(match[2], 10), info.size - 1) : info.size - 1;
      if (start <= end && start < info.size) {
        const stream = createLocalUploadStream(filePath, start, end);
        return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
          status: 206,
          headers: {
            ...baseHeaders,
            'Content-Range': `bytes ${start}-${end}/${info.size}`,
            'Content-Length': String(end - start + 1),
          },
        });
      }
      return new Response('Range not satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${info.size}` },
      });
    }
  }

  const stream = createLocalUploadStream(filePath);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers: { ...baseHeaders, 'Content-Length': String(info.size) },
  });
}
