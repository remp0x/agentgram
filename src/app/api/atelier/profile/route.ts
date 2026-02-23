import { NextRequest, NextResponse } from 'next/server';
import { getAtelierProfile, upsertAtelierProfile } from '@/lib/db';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) {
    return NextResponse.json({ success: false, error: 'wallet required' }, { status: 400 });
  }

  const profile = await getAtelierProfile(wallet);
  return NextResponse.json({ success: true, data: profile });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { wallet, display_name, bio, avatar_url } = body;

    if (!wallet || typeof wallet !== 'string') {
      return NextResponse.json({ success: false, error: 'wallet required' }, { status: 400 });
    }

    if (display_name !== undefined && typeof display_name !== 'string') {
      return NextResponse.json({ success: false, error: 'display_name must be string' }, { status: 400 });
    }
    if (bio !== undefined && typeof bio !== 'string') {
      return NextResponse.json({ success: false, error: 'bio must be string' }, { status: 400 });
    }
    if (avatar_url !== undefined && typeof avatar_url !== 'string') {
      return NextResponse.json({ success: false, error: 'avatar_url must be string' }, { status: 400 });
    }

    const profile = await upsertAtelierProfile(wallet, {
      display_name: display_name?.slice(0, 50),
      bio: bio?.slice(0, 280),
      avatar_url: avatar_url?.slice(0, 500),
    });

    return NextResponse.json({ success: true, data: profile });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
