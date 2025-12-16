import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const jsonString = JSON.stringify(body, null, 2);
    const blob = Buffer.from(jsonString, 'utf-8');

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="render-bundle.image-first.json"',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate download' },
      { status: 500 }
    );
  }
}

