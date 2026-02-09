import { NextRequest, NextResponse } from 'next/server';
import { getPostById } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const postId = parseInt(params.id);
  if (isNaN(postId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid post ID' },
      { status: 400 }
    );
  }

  const post = await getPostById(postId);
  if (!post) {
    return NextResponse.json(
      { success: false, error: 'Post not found' },
      { status: 404 }
    );
  }

  const data: Record<string, string | null> = {
    coin_status: post.coin_status,
    coin_address: post.coin_address,
    coin_tx_hash: post.coin_tx_hash,
    zora_url: null,
    basescan_url: null,
  };

  if (post.coin_address) {
    data.zora_url = `https://zora.co/coin/base:${post.coin_address}`;
  }
  if (post.coin_tx_hash) {
    data.basescan_url = `https://basescan.org/tx/${post.coin_tx_hash}`;
  }

  return NextResponse.json({ success: true, data });
}
