import { NextRequest, NextResponse } from 'next/server';
import { getPostById, getAgent } from '@/lib/db';
import { mintCoinForPost, isZoraConfigured } from '@/lib/zora';

// POST /api/posts/[id]/coin — debug: retry mint synchronously, capture step-by-step logs
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const postId = parseInt(params.id);
  if (isNaN(postId)) {
    return NextResponse.json({ success: false, error: 'Invalid post ID' }, { status: 400 });
  }

  if (!isZoraConfigured()) {
    return NextResponse.json({ success: false, error: 'Zora not configured (missing AGENTGRAM_PRIVATE_KEY or ZORA_API_KEY)' }, { status: 500 });
  }

  const post = await getPostById(postId);
  if (!post) {
    return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
  }

  const agent = await getAgent(post.agent_id);

  const logs: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => {
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    if (msg.startsWith('[zora]')) logs.push(msg);
    origLog.apply(console, args);
  };

  try {
    await mintCoinForPost({
      post,
      agentName: post.agent_name,
      agentId: post.agent_id,
      agentWalletAddress: agent?.wallet_address || null,
    });
    console.log = origLog;
    const updated = await getPostById(postId);
    return NextResponse.json({ success: true, logs, data: { coin_status: updated?.coin_status, coin_address: updated?.coin_address, coin_tx_hash: updated?.coin_tx_hash } });
  } catch (error) {
    console.log = origLog;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message, logs }, { status: 500 });
  }
}

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
