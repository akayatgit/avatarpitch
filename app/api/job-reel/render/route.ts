import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpegPath from 'ffmpeg-static';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { buildUploadPath, uploadPublicFile } from '@/lib/storage';
import {
  JOB_REEL_FORMAT,
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

interface RenderSection {
  overlayUrl: string;
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

async function download(url: string, filePath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download an asset (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, buffer);
}

/**
 * Patch the persisted job reel state. The render must report its outcome to the
 * DB because the phone that kicked it off may be locked / in another app by now.
 */
async function patchProjectState(projectId: string, patch: Record<string, unknown>) {
  try {
    const { data, error } = await supabaseAdmin
      .from('content_creation_requests')
      .select('generated_output')
      .eq('id', projectId)
      .single();

    if (error || !data) return;

    const state =
      typeof data.generated_output === 'string'
        ? JSON.parse(data.generated_output)
        : data.generated_output;

    if (!state || state.format !== JOB_REEL_FORMAT) return;

    const nextState = { ...state, ...patch };
    const status =
      nextState.renderStatus === 'completed'
        ? 'completed'
        : nextState.renderStatus === 'rendering'
          ? 'processing'
          : 'pending';

    await supabaseAdmin
      .from('content_creation_requests')
      .update({ generated_output: nextState, status })
      .eq('id', projectId);
  } catch (error) {
    console.error('Could not patch job reel project state:', error);
  }
}

export async function POST(request: NextRequest) {
  let workDir: string | null = null;
  let projectId: string | null = null;
  try {
    const body = await request.json();
    projectId = typeof body?.projectId === 'string' ? body.projectId : null;
    const backgroundUrl =
      typeof body?.backgroundUrl === 'string' && /^https?:\/\//.test(body.backgroundUrl)
        ? body.backgroundUrl
        : null;
    const backgroundType = body?.backgroundType === 'image' ? 'image' : 'video';
    const sections: RenderSection[] = Array.isArray(body?.sections)
      ? body.sections
          .filter(
            (section: any): section is RenderSection =>
              typeof section?.overlayUrl === 'string' &&
              /^https?:\/\//.test(section.overlayUrl) &&
              typeof section?.durationSec === 'number'
          )
          .map((section: RenderSection) => ({
            overlayUrl: section.overlayUrl,
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

    if (projectId) {
      await patchProjectState(projectId, {
        renderStatus: 'rendering',
        renderError: null,
        renderStartedAt: new Date().toISOString(),
        finalVideoUrl: null,
      });
    }

    const totalDuration = sections.reduce((sum, section) => sum + section.durationSec, 0);
    const size = `${JOB_REEL_WIDTH}x${JOB_REEL_HEIGHT}`;
    const coverFilter = `scale=${JOB_REEL_WIDTH}:${JOB_REEL_HEIGHT}:force_original_aspect_ratio=increase,crop=${JOB_REEL_WIDTH}:${JOB_REEL_HEIGHT}`;
    const encodeArgs = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-an'];

    workDir = await mkdtemp(join(tmpdir(), 'job-reel-'));

    // 1. Download the background + every section overlay PNG
    const backgroundPath = join(workDir, backgroundType === 'image' ? 'bg-src.jpg' : 'bg-src.mp4');
    await download(backgroundUrl, backgroundPath);
    const overlayPaths: string[] = [];
    for (let index = 0; index < sections.length; index++) {
      const overlayPath = join(workDir, `overlay-${index}.png`);
      await download(sections[index].overlayUrl, overlayPath);
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
    const finalVideoUrl = await uploadPublicFile({
      path: buildUploadPath('job-reel/videos', `job-reel-${Date.now()}.mp4`),
      body: outputBuffer,
      contentType: 'video/mp4',
    });

    if (projectId) {
      await patchProjectState(projectId, {
        renderStatus: 'completed',
        renderError: null,
        finalVideoUrl,
      });
    }

    return NextResponse.json({ success: true, finalVideoUrl });
  } catch (error) {
    console.error('Job reel render error:', error);
    const message = error instanceof Error ? error.message : 'Failed to render the job reel';
    if (projectId) {
      await patchProjectState(projectId, {
        renderStatus: 'failed',
        renderError: message,
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
