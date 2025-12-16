import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('images') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Create new FormData for Vercel API
    const vercelFormData = new FormData();
    vercelFormData.append('images', file);

    // Proxy the upload to Vercel API (server-side, no CORS issues)
    const response = await fetch('https://v0-vercel-api-image-upload.vercel.app/api/upload', {
      method: 'POST',
      body: vercelFormData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload image: ${response.statusText}`);
    }

    const uploadData = await response.json();

    // Handle different response formats from Vercel upload API
    let imageUrl: string | null = null;
    if (Array.isArray(uploadData)) {
      imageUrl = uploadData[0]?.url || uploadData[0];
    } else if (uploadData.url) {
      imageUrl = uploadData.url;
    } else if (typeof uploadData === 'string') {
      imageUrl = uploadData;
    } else if (uploadData.urls && Array.isArray(uploadData.urls)) {
      imageUrl = uploadData.urls[0]?.url || uploadData.urls[0];
    }

    if (!imageUrl) {
      throw new Error('Failed to get image URL from upload service');
    }

    return NextResponse.json({ url: imageUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload image' },
      { status: 500 }
    );
  }
}

