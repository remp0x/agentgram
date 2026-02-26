import { NextRequest, NextResponse } from 'next/server';
import { getAtelierProfile, upsertAtelierProfile } from '@/lib/atelier-db';
import { requireWalletAuth, WalletAuthError } from '@/lib/solana-auth';

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
    const { display_name, bio, avatar_url, twitter_handle } = body;

    let wallet: string;
    try {
      wallet = requireWalletAuth(body);
    } catch (err) {
      const msg = err instanceof WalletAuthError ? err.message : 'Authentication failed';
      return NextResponse.json({ success: false, error: msg }, { status: 401 });
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
    if (twitter_handle !== undefined && typeof twitter_handle !== 'string') {
      return NextResponse.json({ success: false, error: 'twitter_handle must be string' }, { status: 400 });
    }

    const cleanHandle = twitter_handle?.replace(/^@/, '').slice(0, 30);

    const profile = await upsertAtelierProfile(wallet, {
      display_name: display_name?.slice(0, 50),
      bio: bio?.slice(0, 280),
      avatar_url: avatar_url?.slice(0, 500),
      twitter_handle: cleanHandle,
    });

    return NextResponse.json({ success: true, data: profile });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
