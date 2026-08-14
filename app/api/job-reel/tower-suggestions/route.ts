import { NextResponse } from 'next/server';
import { fetchTowerHealth, fetchTowerReelSuggestions } from '@/lib/towerClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Which reels are worth making this week" + live-data health, proxied so
 * the partner token never reaches the browser.
 */
export async function GET() {
  try {
    const [suggestions, health] = await Promise.allSettled([
      fetchTowerReelSuggestions({ freshDays: 7, minJobs: 4, limit: 10 }),
      fetchTowerHealth(),
    ]);

    if (suggestions.status === 'rejected') {
      throw suggestions.reason;
    }

    return NextResponse.json({
      success: true,
      suggestions: suggestions.value.suggestions,
      health: health.status === 'fulfilled' ? health.value : null,
    });
  } catch (error) {
    console.error('Tower suggestions proxy error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not reach the Watch Tower jobs API',
      },
      { status: 502 }
    );
  }
}
