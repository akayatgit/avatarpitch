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
// inline videos are only the fallback for when the tower asset API isn't
// enabled yet; real-length reels need the tower storage live
const MAX_INLINE_VIDEO_BYTES = 3_000_000;

const DOWNLOAD_HEADERS = {
  Accept: '*/*',
  Referer: 'https://www.pinterest.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
} as const;

interface RenderSection {
  overlayDataUrl: string;
  durationSec: number;
}

async function runFfmpeg(args: string[]) {
  if (!ffmpegPath) {
    throw new Error('ffmpeg binary not available on this deployment');
  }
  try {
    await execFileAsync(ffmpegPath, args, { maxBuffer: 32 * 1024 * 1024 });
  } catch (error: any) {
    const stderr: string = error?.stderr ?? '';
    console.error('ffmpeg failed:', stderr.slice(-2000));
    throw new Error('Video rendering failed while processing the clips');
  }
}

async function downloadBackground(url: string, filePath: string) {
  const response = await fetch(url, { headers: DOWNLOAD_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to download the background (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) {
    throw new Error('The background link returned an empty file — re-paste the pin link');
  }
  await writeFile(filePath, buffer);
}

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

function isRenderSection(section: any): section is RenderSection {
  return (
    typeof section?.overlayDataUrl === 'string' &&
    PNG_DATA_URL.test(section.overlayDataUrl) &&
    typeof section?.durationSec === 'number'
  );
}

export async function POST(request: NextRequest) {
  let workDir: string | null = null;
  let ticket: string | null = null;
  try {
    const body = await request.json();
    ticket = isValidTicket(body?.ticket) ? body.ticket : null;
    const backgroundUrl =
      typeof body?.backgroundUrl === 'string' && /^https?:\/\//.test(body.backgroundUrl)
        ? body.backgroundUrl
        : null;
    const backgroundType = body?.backgroundType === 'image' ? 'image' : 'video';
    const sections: RenderSection[] = Array.isArray(body?.sections)
      ? body.sections.filter(isRenderSection).map((section: RenderSection) => ({
          overlayDataUrl: section.overlayDataUrl,
          durationSec: Math.min(
            MAX_SECTION_SECONDS,
            Math.max(MIN_SECTION_SECONDS, section.durationSec)
          ),
        }))
      : [];

    if (!backgroundUrl) {
      return NextResponse.json({ error: 'A background video is required' }, { status: 400 });
    }
    if (sections.length === 0 || sections.length > MAX_JOB_CARDS + 1) {
      return NextResponse.json(
        { error: `Provide between 1 and ${MAX_JOB_CARDS + 1} sections to render` },
        { status: 400 }
      );
    }

    if (ticket) {
      await writeRenderStatus(ticket, { status: 'rendering' });
    }

    const totalDuration = sections.reduce((sum, section) => sum + section.durationSec, 0);
    const size = `${JOB_REEL_WIDTH}x${JOB_REEL_HEIGHT}`;
    const coverFilter = `scale=${JOB_REEL_WIDTH}:${JOB_REEL_HEIGHT}:force_original_aspect_ratio=increase,crop=${JOB_REEL_WIDTH}:${JOB_REEL_HEIGHT}`;
    const encodeArgs = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-an'];

    workDir = await mkdtemp(join(tmpdir(), 'job-reel-'));

    // 1. Background from the CDN + overlay PNGs straight out of the request body
    const backgroundPath = join(workDir, backgroundType === 'image' ? 'bg-src.jpg' : 'bg-src.mp4');
    await downloadBackground(backgroundUrl, backgroundPath);
    const overlayPaths: string[] = [];
    for (let index = 0; index < sections.length; index++) {
      const overlayPath = join(workDir, `overlay-${index}.png`);
      const base64 = sections[index].overlayDataUrl.match(PNG_DATA_URL)![1];
      await writeFile(overlayPath, Buffer.from(base64, 'base64'));
      overlayPaths.push(overlayPath);
    }

    // 2. One continuous background track covering all sections
    //    (video: looped to fill; image: subtle Ken Burns zoom)
    const backgroundFull = join(workDir, 'bg-full.mp4');
    if (backgroundType === 'video') {
      await runFfmpeg([
        '-y',
        '-stream_loop', '-1',
        '-i', backgroundPath,
        '-t', String(totalDuration),
        '-vf', `${coverFilter},fps=${JOB_REEL_FPS},format=yuv420p`,
        ...encodeArgs,
        backgroundFull,
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
        '-t', String(totalDuration),
        '-i', backgroundPath,
        '-vf', zoomFilter,
        ...encodeArgs,
        backgroundFull,
      ]);
    }

    // 3. Slice the background per section and composite that section's overlay PNG
    const segments: string[] = [];
    let offset = 0;
    for (let index = 0; index < sections.length; index++) {
      const segmentPath = join(workDir, `seg-${index}.mp4`);
      await runFfmpeg([
        '-y',
        '-ss', String(offset),
        '-t', String(sections[index].durationSec),
        '-i', backgroundFull,
        '-i', overlayPaths[index],
        '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p',
        '-r', String(JOB_REEL_FPS),
        ...encodeArgs,
        segmentPath,
      ]);
      segments.push(segmentPath);
      offset += sections[index].durationSec;
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
    //    leave-the-app support). While the tower endpoint isn't enabled yet,
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
