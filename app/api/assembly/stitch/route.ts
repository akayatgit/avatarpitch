import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpegPath from 'ffmpeg-static';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { buildUploadPath, uploadPublicFile } from '@/lib/storage';
import { ASSEMBLY_ASPECT_RATIOS, ASSEMBLY_FORMAT, MAX_BUILDINGS } from '@/lib/assembly';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '1:1': { width: 720, height: 720 },
};

async function runFfmpeg(args: string[]) {
  if (!ffmpegPath) {
    throw new Error('ffmpeg binary not available on this deployment');
  }
  try {
    await execFileAsync(ffmpegPath, args, { maxBuffer: 32 * 1024 * 1024 });
  } catch (error: any) {
    const stderr: string = error?.stderr ?? '';
    console.error('ffmpeg failed:', stderr.slice(-2000));
    throw new Error('Video stitching failed while processing the clips');
  }
}

async function download(url: string, filePath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download clip (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, buffer);
}

/** Persist the stitched showcase URL onto the assembly project. */
async function persistFinalVideo(projectId: string, finalVideoUrl: string) {
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

    if (!state || state.format !== ASSEMBLY_FORMAT) return;
    state.finalVideoUrl = finalVideoUrl;

    await supabaseAdmin
      .from('content_creation_requests')
      .update({ generated_output: state, status: 'completed' })
      .eq('id', projectId);
  } catch (error) {
    console.error('Could not persist final video URL to assembly project:', error);
  }
}

export async function POST(request: NextRequest) {
  let workDir: string | null = null;
  try {
    const body = await request.json();
    const videoUrls: string[] = Array.isArray(body?.videoUrls)
      ? body.videoUrls.filter((url: unknown): url is string => typeof url === 'string' && /^https?:\/\//.test(url))
      : [];
    const titleCardUrl =
      typeof body?.titleCardUrl === 'string' && /^https?:\/\//.test(body.titleCardUrl)
        ? body.titleCardUrl
        : null;
    const aspectRatio = (ASSEMBLY_ASPECT_RATIOS as readonly string[]).includes(body?.aspectRatio)
      ? (body.aspectRatio as string)
      : '16:9';
    const projectId = typeof body?.projectId === 'string' ? body.projectId : null;

    if (videoUrls.length === 0 || videoUrls.length > MAX_BUILDINGS) {
      return NextResponse.json(
        { error: 'Provide between 1 and 6 reveal video URLs to stitch.' },
        { status: 400 }
      );
    }

    const { width, height } = DIMENSIONS[aspectRatio];
    // Normalize every segment to identical codec/size/fps so concat can stream-copy
    const normalizeFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p`;
    const encodeArgs = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-an'];

    workDir = await mkdtemp(join(tmpdir(), 'assembly-stitch-'));
    const segments: string[] = [];

    // Optional 2-second title card (client-rendered PNG)
    if (titleCardUrl) {
      const titlePng = join(workDir, 'title.png');
      await download(titleCardUrl, titlePng);
      const titleSegment = join(workDir, 'seg-title.mp4');
      await runFfmpeg([
        '-y',
        '-loop', '1',
        '-t', '2',
        '-i', titlePng,
        '-vf', normalizeFilter,
        ...encodeArgs,
        titleSegment,
      ]);
      segments.push(titleSegment);
    }

    // Normalize each reveal clip
    for (let index = 0; index < videoUrls.length; index++) {
      const clipPath = join(workDir, `clip-${index}.mp4`);
      await download(videoUrls[index], clipPath);
      const segmentPath = join(workDir, `seg-${index}.mp4`);
      await runFfmpeg(['-y', '-i', clipPath, '-vf', normalizeFilter, ...encodeArgs, segmentPath]);
      segments.push(segmentPath);
    }

    // Concat with stream copy (all segments share codec parameters now)
    const listPath = join(workDir, 'list.txt');
    await writeFile(
      listPath,
      segments.map((segment) => `file '${segment.replace(/'/g, "'\\''")}'`).join('\n')
    );
    const outputPath = join(workDir, 'showcase.mp4');
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
      path: buildUploadPath('assembly/videos', `showcase-${Date.now()}.mp4`),
      body: outputBuffer,
      contentType: 'video/mp4',
    });

    if (projectId) {
      await persistFinalVideo(projectId, finalVideoUrl);
    }

    return NextResponse.json({ success: true, finalVideoUrl });
  } catch (error) {
    console.error('Assembly stitch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stitch the showcase video' },
      { status: 500 }
    );
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
