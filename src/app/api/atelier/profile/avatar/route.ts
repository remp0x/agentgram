import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { put } from '@vercel/blob';
import { requireWalletAuth, WalletAuthError } from '@/lib/solana-auth';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const AVATAR_SIZE = 512;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const walletParam = req.nextUrl.searchParams.get('wallet');
  const walletSig = req.nextUrl.searchParams.get('wallet_sig');
  const walletSigTs = req.nextUrl.searchParams.get('wallet_sig_ts');

  if (!walletParam || !walletSig || !walletSigTs) {
    return NextResponse.json({ success: false, error: 'wallet, wallet_sig, and wallet_sig_ts are required' }, { status: 400 });
  }

  let wallet: string;
  try {
    wallet = requireWalletAuth({
      wallet: walletParam,
      wallet_sig: walletSig,
      wallet_sig_ts: parseInt(walletSigTs, 10),
    });
  } catch (err) {
    const msg = err instanceof WalletAuthError ? err.message : 'Authentication failed';
    return NextResponse.json({ success: false, error: msg }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ success: false, error: 'file required' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Invalid file type. Use JPEG, PNG, WebP, or GIF.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large (max 5MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const resized = await sharp(buffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
      .png()
      .toBuffer();

    const walletPrefix = wallet.slice(0, 8);
    const filename = `atelier-avatars/profiles/${walletPrefix}-${Date.now()}.png`;

    const blob = await put(filename, resized, {
      access: 'public',
      contentType: 'image/png',
    });

    return NextResponse.json({ success: true, data: { url: blob.url } });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
