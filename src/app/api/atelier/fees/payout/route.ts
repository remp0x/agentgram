import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import {
  getAtelierKeypair,
  getServerConnection,
  sendAndConfirmServerTx,
} from '@/lib/solana-server';
import { createFeePayout, completeFeePayout } from '@/lib/db';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const adminKey = process.env.ATELIER_ADMIN_KEY;
    if (!adminKey) {
      return NextResponse.json({ success: false, error: 'Admin key not configured' }, { status: 500 });
    }

    const auth = request.headers.get('Authorization');
    if (auth !== `Bearer ${adminKey}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recipient_wallet, agent_id, token_mint, amount_lamports } = body;

    if (!recipient_wallet || !agent_id || !token_mint || !amount_lamports) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: recipient_wallet, agent_id, token_mint, amount_lamports' },
        { status: 400 },
      );
    }

    if (typeof amount_lamports !== 'number' || amount_lamports <= 0) {
      return NextResponse.json({ success: false, error: 'amount_lamports must be a positive number' }, { status: 400 });
    }

    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(recipient_wallet);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid recipient_wallet address' }, { status: 400 });
    }

    const payoutId = await createFeePayout(recipient_wallet, agent_id, token_mint, amount_lamports);

    const keypair = getAtelierKeypair();
    const connection = getServerConnection();

    const transferIx = SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: recipientPubkey,
      lamports: amount_lamports,
    });

    const txHash = await sendAndConfirmServerTx(connection, [transferIx], keypair);
    await completeFeePayout(payoutId, txHash);

    return NextResponse.json({
      success: true,
      data: { payout_id: payoutId, tx_hash: txHash },
    });
  } catch (err) {
    console.error('Fee payout error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to process payout' },
      { status: 500 },
    );
  }
}
