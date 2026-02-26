import { NextResponse } from 'next/server';
import { OnlinePumpSdk } from '@pump-fun/pump-sdk';
import { getServerConnection, ATELIER_PUBKEY } from '@/lib/solana-server';
import { getTotalSwept, getTotalPaidOut } from '@/lib/atelier-db';

export async function GET(): Promise<NextResponse> {
  try {
    const connection = getServerConnection();
    const sdk = new OnlinePumpSdk(connection);

    const [vaultBalance, totalSwept, totalPaidOut] = await Promise.all([
      sdk.getCreatorVaultBalanceBothPrograms(ATELIER_PUBKEY),
      getTotalSwept(),
      getTotalPaidOut(),
    ]);

    const vaultLamports = vaultBalance.toNumber();

    return NextResponse.json({
      success: true,
      data: {
        vault_balance_lamports: vaultLamports,
        vault_balance_sol: vaultLamports / 1e9,
        total_swept_lamports: totalSwept,
        total_paid_out_lamports: totalPaidOut,
      },
    });
  } catch (err) {
    console.error('Fee balance error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch fee balance' },
      { status: 500 },
    );
  }
}
