import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

// Configure route to handle larger file uploads
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max duration
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      console.error('Failed to parse multipart form data:', error);
      return NextResponse.json({ error: 'Failed to parse upload payload' }, { status: 400 });
    }

    const file = formData.get('images') as File;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const blob = await put(file.name, file, {
      access: 'public',
      contentType: file.type || 'application/octet-stream',
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload image' },
      { status: 500 }
    );
  }
}

