import { NextResponse } from 'next/server';
import { ensureContentTypesSeeded, SEED_CONTENT_TYPES } from '@/lib/seedData';

/**
 * GET /api/seed-content-types
 *
 * Idempotent: inserts content types that don't already exist (matched by name).
 * Safe to call multiple times.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const seeded = await ensureContentTypesSeeded();
    if (seeded.length === 0) {
      return NextResponse.json({
        message: 'All content types already seeded.',
        total: SEED_CONTENT_TYPES.length,
        seeded: [],
      });
    }
    return NextResponse.json({
      success: true,
      seeded,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Seed failed' },
      { status: 500 }
    );
  }
}
