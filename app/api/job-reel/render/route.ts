import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpegPath from 'ffmpeg-static';
import { isValidTicket, putTowerAsset, writeRenderStatus } from '@/lib/towerStorage';
import {
  JOB_REEL_FPS,
  JOB_REEL_HEIGHT,
  JOB_REEL_WIDTH,
  MAX_JOB_CARDS,
  MAX_SECTION_SECONDS,
  MIN_SECTION_SECONDS,
} from '@/lib/jobReel';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);

// Vercel serverless responses cap at ~4.5 MB and base64 inflates 4/3 —
// inline videos are only the fallback for when the tower asset API is down
const MAX_INLINE_VIDEO_BYTES = 3_000_000;

/** Logo pop-in: 0.5s ease-out-back (fast, physical, slight overshoot). */
const LOGO_ANIM_SECONDS = 0.5;
const LOGO_DROP_PX = 40;

const DOWNLOAD_HEADERS = {
  Accept: '*/*',
  Referer: 'https://www.pinterest.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
} as const;

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

interface RenderOverlay {
  overlayDataUrl: string;
  /** Visible window within the section (defaults to the whole section). */
  fromSec?: number;
  toSec?: number;
}

interface RenderLogo {
  dataUrl: string;
  x: number;
  y: number;
}

interface RenderSection {
  durationSec: number;
  overlays: RenderOverlay[];
  logo?: RenderLogo | null;
  /** Optional per-section background; falls back to the default background. */
  backgroundUrl?: string | null;
  backgroundType?: 'video' | 'image' | null;
}

async function runFfmpeg(args: string[]) {
  if (!ffmpegPath) {
    throw new Error('ffmpeg binary not available on this deployment');
  }
  try {
    await execFileAsync(ffmpegPath, args, { maxBuffer: 32 * 1024 * 1024 });
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        'The ffmpeg binary is missing from this deployment bundle (tracing issue) — redeploy needed'
      );
    }
    const stderr: string = error?.stderr ?? '';
    console.error('ffmpeg failed:', stderr.slice(-2000));
    // Surface the real ffmpeg reason — production has no other way to see it
    const detail = stderr
      .trim()
      .split('\n')
      .filter(Boolean)
      .slice(-2)
      .join(' ')
      .slice(-240);
    throw new Error(
      detail ? `Video rendering failed: ${detail}` : 'Video rendering failed while processing the clips'
    );
  }
}

async function downloadBackground(url: string, filePath: string) {
  const response = await fetch(url, { headers: DOWNLOAD_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to download a background (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) {
    throw new Error('A background link returned an empty file — re-pick that background');
  }
  await writeFile(filePath, buffer);
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//.test(value);
}

function clampDuration(value: number): number {
  return Math.min(MAX_SECTION_SECONDS, Math.max(MIN_SECTION_SECONDS, value));
}

function parseSections(raw: unknown): RenderSection[] {
  if (!Array.isArray(raw)) return [];
  const sections: RenderSection[] = [];
  for (const entry of raw) {
    if (typeof entry?.durationSec !== 'number') continue;
    const durationSec = clampDuration(entry.durationSec);
    const overlays: RenderOverlay[] = Array.isArray(entry?.overlays)
      ? entry.overlays
          .filter(
            (overlay: any) =>
              typeof overlay?.overlayDataUrl === 'string' &&
              PNG_DATA_URL.test(overlay.overlayDataUrl)
          )
          .slice(0, 3)
          .map((overlay: any) => ({
            overlayDataUrl: overlay.overlayDataUrl,
            fromSec:
              typeof overlay.fromSec === 'number'
                ? Math.max(0, Math.min(overlay.fromSec, durationSec))
                : undefined,
            toSec:
              typeof overlay.toSec === 'number'
                ? Math.max(0, Math.min(overlay.toSec, durationSec))
                : undefined,
          }))
      : [];
    if (overlays.length === 0) continue;
    const logo: RenderLogo | null =
      entry?.logo &&
      typeof entry.logo.dataUrl === 'string' &&
      PNG_DATA_URL.test(entry.logo.dataUrl) &&
      typeof entry.logo.x === 'number' &&
      typeof entry.logo.y === 'number'
        ? {
            dataUrl: entry.logo.dataUrl,
            x: Math.round(entry.logo.x),
            y: Math.round(entry.logo.y),
          }
        : null;
    sections.push({
      durationSec,
      overlays,
      logo,
      backgroundUrl: isHttpUrl(entry?.backgroundUrl) ? entry.backgroundUrl : null,
      backgroundType: entry?.backgroundType === 'image' ? 'image' : entry?.backgroundType === 'video' ? 'video' : null,
    });
  }
  return sections;
}

/** ease-out-back position expression for the logo pop-in (lavfi syntax). */
function logoYExpression(finalY: number): string {
  const p = `min(t/${LOGO_ANIM_SECONDS},1)`;
  const ease = `(1+2.70158*pow(${p}-1,3)+1.70158*pow(${p}-1,2))`;
  return `${finalY}-${LOGO_DROP_PX}+${LOGO_DROP_PX}*${ease}`;
}

export async function POST(request: NextRequest) {
  let workDir: string | null = null;
  let ticket: string | null = null;
  try {
    const body = await request.json();
    ticket = isValidTicket(body?.ticket) ? body.ticket : null;
    const defaultBackgroundUrl = isHttpUrl(body?.background?.url) ? body.background.url : null;
    const defaultBackgroundType = body?.background?.type === 'image' ? 'image' : 'video';
    const sections = parseSections(body?.sections);

    if (!defaultBackgroundUrl) {
      return NextResponse.json({ error: 'A background video is required' }, { status: 400 });
    }
    // hook + cards + CTA
    if (sections.length === 0 || sections.length > MAX_JOB_CARDS + 2) {
      return NextResponse.json(
        { error: `Provide between 1 and ${MAX_JOB_CARDS + 2} sections to render` },
        { status: 400 }
      );
    }

    if (ticket) {
      await writeRenderStatus(ticket, { status: 'rendering' });
    }

    const size = `${JOB_REEL_WIDTH}x${JOB_REEL_HEIGHT}`;
    const coverFilter = `scale=${JOB_REEL_WIDTH}:${JOB_REEL_HEIGHT}:force_original_aspect_ratio=increase,crop=${JOB_REEL_WIDTH}:${JOB_REEL_HEIGHT}`;
    const encodeArgs = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-an'];

    workDir = await mkdtemp(join(tmpdir(), 'job-reel-'));

    // 1. Group sections by their effective background so a shared background
    //    plays continuously across consecutive sections (no visible restart)
    interface BgTrack {
      url: string;
      type: 'video' | 'image';
      totalSec: number;
      cursorSec: number;
      trackPath: string;
    }
    const bgTracks = new Map<string, BgTrack>();
    for (const section of sections) {
      const url = section.backgroundUrl ?? defaultBackgroundUrl;
      const type = section.backgroundUrl
        ? (section.backgroundType ?? 'video')
        : defaultBackgroundType;
      const track = bgTracks.get(url);
      if (track) {
        track.totalSec += section.durationSec;
      } else {
        bgTracks.set(url, {
          url,
          type,
          totalSec: section.durationSec,
          cursorSec: 0,
          trackPath: join(workDir, `bg-track-${bgTracks.size}.mp4`),
        });
      }
    }

    // 2. Build one continuous track per unique background
    //    (video: looped to fill; image: subtle Ken Burns zoom)
    let bgIndex = 0;
    for (const track of Array.from(bgTracks.values())) {
      const sourcePath = join(
        workDir,
        track.type === 'image' ? `bg-src-${bgIndex}.jpg` : `bg-src-${bgIndex}.mp4`
      );
      bgIndex += 1;
      await downloadBackground(track.url, sourcePath);
      if (track.type === 'video') {
        await runFfmpeg([
          '-y',
          '-stream_loop', '-1',
          '-i', sourcePath,
          '-t', String(track.totalSec),
          '-vf', `${coverFilter},fps=${JOB_REEL_FPS},format=yuv420p`,
          ...encodeArgs,
          track.trackPath,
        ]);
      } else {
        // Upscale 2x before zoompan to avoid pixel jitter on the slow zoom
        const zoomFilter = [
          `scale=${JOB_REEL_WIDTH * 2}:${JOB_REEL_HEIGHT * 2}:force_original_aspect_ratio=increase`,
          `crop=${JOB_REEL_WIDTH * 2}:${JOB_REEL_HEIGHT * 2}`,
          `zoompan=z='min(1+on*0.0006,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${size}:fps=${JOB_REEL_FPS}`,
          'format=yuv420p',
        ].join(',');
        await runFfmpeg([
          '-y',
          '-loop', '1',
          '-t', String(track.totalSec),
          '-i', sourcePath,
          '-vf', zoomFilter,
          ...encodeArgs,
          track.trackPath,
        ]);
      }
    }

    // 3. Per section: slice its window from its background track, composite
    //    the timed overlays, then the eased logo pop-in
    const segments: string[] = [];
    for (let index = 0; index < sections.length; index++) {
      const section = sections[index];
      const track = bgTracks.get(section.backgroundUrl ?? defaultBackgroundUrl)!;
      const offset = track.cursorSec;
      track.cursorSec += section.durationSec;

      const args: string[] = [
        '-y',
        '-ss', String(offset),
        '-t', String(section.durationSec),
        '-i', track.trackPath,
      ];

      const overlayPaths: string[] = [];
      for (let i = 0; i < section.overlays.length; i++) {
        const overlayPath = join(workDir, `overlay-${index}-${i}.png`);
        const base64 = section.overlays[i].overlayDataUrl.match(PNG_DATA_URL)![1];
        await writeFile(overlayPath, Buffer.from(base64, 'base64'));
        overlayPaths.push(overlayPath);
        args.push('-i', overlayPath);
      }

      let logoInputIndex = -1;
      if (section.logo) {
        const logoPath = join(workDir, `logo-${index}.png`);
        const base64 = section.logo.dataUrl.match(PNG_DATA_URL)![1];
        await writeFile(logoPath, Buffer.from(base64, 'base64'));
        logoInputIndex = 1 + section.overlays.length;
        // Loop the still so fade (alpha over time) has frames to work on
        args.push(
          '-loop', '1',
          '-framerate', String(JOB_REEL_FPS),
          '-t', String(section.durationSec),
          '-i', logoPath
        );
      }

      const chain: string[] = [];
      let current = '[0:v]';
      section.overlays.forEach((overlay, i) => {
        const inputIndex = i + 1;
        const from = overlay.fromSec ?? 0;
        const to = overlay.toSec ?? section.durationSec;
        const timed = from > 0 || to < section.durationSec;
        const enable = timed ? `:enable='between(t,${from},${to})'` : '';
        const label = `[v${inputIndex}]`;
        chain.push(`${current}[${inputIndex}:v]overlay=0:0:format=auto${enable}${label}`);
        current = label;
      });
      if (section.logo && logoInputIndex >= 0) {
        chain.push(
          `[${logoInputIndex}:v]format=rgba,fade=t=in:st=0:d=0.35:alpha=1[lgf]`
        );
        chain.push(
          `${current}[lgf]overlay=x=${section.logo.x}:y='${logoYExpression(section.logo.y)}'[vl]`
        );
        current = '[vl]';
      }
      chain.push(`${current}format=yuv420p[out]`);

      const segmentPath = join(workDir, `seg-${index}.mp4`);
      args.push(
        '-filter_complex', chain.join(';'),
        '-map', '[out]',
        '-r', String(JOB_REEL_FPS),
        '-t', String(section.durationSec),
        ...encodeArgs,
        segmentPath
      );
      await runFfmpeg(args);
      segments.push(segmentPath);
    }

    // 4. Concat all sections (identical codec params → stream copy)
    const listPath = join(workDir, 'list.txt');
    await writeFile(
      listPath,
      segments.map((segment) => `file '${segment.replace(/'/g, "'\\''")}'`).join('\n')
    );
    const outputPath = join(workDir, 'job-reel.mp4');
    await runFfmpeg([
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      outputPath,
    ]);

    const outputBuffer = await readFile(outputPath);

    // 5. Persist on the ThinkPad through the tower asset API (download-later +
    //    leave-the-app support). While the tower endpoint is unreachable,
    //    videos are returned inline as a data URL — compressed down if the
    //    full-quality file doesn't fit the serverless response cap.
    const videoKey = `job-reel/videos/${ticket ?? `reel-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}.mp4`;
    let finalVideoUrl = await putTowerAsset(videoKey, outputBuffer, 'video/mp4');
    if (!finalVideoUrl) {
      let inlineBuffer = outputBuffer;
      if (inlineBuffer.length > MAX_INLINE_VIDEO_BYTES) {
        const compactPath = join(workDir, 'job-reel-compact.mp4');
        await runFfmpeg([
          '-y',
          '-i', outputPath,
          '-vf', 'scale=540:960',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-an',
          '-movflags', '+faststart',
          compactPath,
        ]);
        inlineBuffer = await readFile(compactPath);
      }
      if (inlineBuffer.length > MAX_INLINE_VIDEO_BYTES) {
        throw new Error(
          'The video is too large to return while Watch Tower storage is offline. Make a shorter reel or try again later.'
        );
      }
      finalVideoUrl = `data:video/mp4;base64,${inlineBuffer.toString('base64')}`;
    }

    if (ticket) {
      await writeRenderStatus(ticket, { status: 'completed', finalVideoUrl });
    }

    return NextResponse.json({ success: true, finalVideoUrl });
  } catch (error) {
    console.error('Job reel render error:', error);
    const message = error instanceof Error ? error.message : 'Failed to render the job reel';
    if (ticket) {
      await writeRenderStatus(ticket, { status: 'failed', error: message });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
