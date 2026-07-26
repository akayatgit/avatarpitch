import { NextRequest, NextResponse } from 'next/server';
import { analyzePath } from '@/lib/tools/analyzePath';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/** Shared path-analysis tool wrapper (Gemini 2.5 Flash). */
export async function POST(request: NextRequest) {
  try {
    const { annotatedImage, contextDescription } = await request.json();

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    if (!annotatedImage || typeof annotatedImage !== 'string') {
      return NextResponse.json({ error: 'annotatedImage is required' }, { status: 400 });
    }

    const result = await analyzePath(
      annotatedImage,
      typeof contextDescription === 'string' ? contextDescription : undefined
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Path analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze path' },
      { status: 500 }
    );
  }
}
