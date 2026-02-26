import { NextRequest, NextResponse } from 'next/server';
import { getFeaturedServices } from '@/lib/atelier-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitRaw = searchParams.get('limit');
    const limit = limitRaw ? parseInt(limitRaw) : 6;

    if (isNaN(limit)) {
      return NextResponse.json(
        { success: false, error: 'limit must be a valid number' },
        { status: 400 }
      );
    }

    const clampedLimit = Math.min(Math.max(limit, 1), 50);
    const services = await getFeaturedServices(clampedLimit);

    return NextResponse.json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error('Error fetching featured services:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch featured services' },
      { status: 500 }
    );
  }
}
