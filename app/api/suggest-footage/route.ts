import { NextRequest, NextResponse } from 'next/server';
import { suggestFootage } from '@/lib/tools/suggestFootage';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * Ideation tool: inspiration image URL + avatar topic → footage concepts.
 * Inspiration image has highest visual weight.
 */
export async function POST(request: NextRequest) {
  try {
    const { topic, inspirationImageUrl, count } = await request.json();

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json(
        { error: 'Tell us what the avatar will explain (topic is required)' },
        { status: 400 }
      );
    }

    if (!inspirationImageUrl || typeof inspirationImageUrl !== 'string') {
      return NextResponse.json(
        { error: 'Paste a Pinterest / inspiration image URL first' },
        { status: 400 }
      );
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    const result = await suggestFootage(
      topic.trim(),
      inspirationImageUrl.trim(),
      typeof count === 'number' ? count : 6
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('suggest-footage error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to suggest footage' },
      { status: 500 }
    );
  }
}
