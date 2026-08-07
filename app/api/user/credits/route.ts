import { NextResponse } from 'next/server';

/** Auth removed — return a fixed local credit balance. */
export async function GET() {
  return NextResponse.json({ credits: 9999 });
}
