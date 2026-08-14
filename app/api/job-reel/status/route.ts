import { NextRequest, NextResponse } from 'next/server';
import { isValidTicket, readRenderStatus } from '@/lib/towerStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Render-status poll by ticket. Status docs live on the ThinkPad behind the
 * tower asset API, so polling works across page reloads and after the phone
 * left the browser mid-render.
 */
export async function GET(request: NextRequest) {
  const ticket = request.nextUrl.searchParams.get('ticket');
  if (!isValidTicket(ticket)) {
    return NextResponse.json({ error: 'Invalid ticket' }, { status: 400 });
  }
  try {
    const doc = await readRenderStatus(ticket);
    if (!doc) {
      // Tower storage not enabled yet, or the render died before reporting —
      // the client treats 'unknown' with a stale timer as a failed render
      return NextResponse.json({ renderStatus: 'unknown' });
    }
    return NextResponse.json({
      renderStatus: doc.status,
      finalVideoUrl: doc.finalVideoUrl ?? null,
      renderError: doc.error ?? null,
    });
  } catch (error) {
    console.error('Job reel status error:', error);
    return NextResponse.json({ renderStatus: 'unknown' });
  }
}
