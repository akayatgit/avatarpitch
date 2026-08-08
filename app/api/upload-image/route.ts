import { NextRequest, NextResponse } from 'next/server';
import { buildUploadPath, uploadPublicFile } from '@/lib/storage';

// Configure route to handle larger file uploads
export const runtime = 'nodejs';
export const maxDuration = 60;
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

    const arrayBuffer = await file.arrayBuffer();
    const path = buildUploadPath('studio', file.name || 'image.jpg');
    const url = await uploadPublicFile({
      path,
      body: Buffer.from(arrayBuffer),
      contentType: file.type || 'application/octet-stream',
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload image' },
      { status: 500 }
    );
  }
}
