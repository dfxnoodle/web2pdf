import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Validate that it's a proper image URL
    try {
      new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid image URL format' },
        { status: 400 }
      );
    }

    // Fetch the image from the external URL
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the content type
    const contentType = response.headers.get('content-type');
    
    // Validate that it's actually an image
    if (!contentType || !contentType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'URL does not point to a valid image' },
        { status: 400 }
      );
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error proxying image:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}
