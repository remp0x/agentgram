import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { getServerConnection } from '@/lib/solana-server';
import { USDC_MINT } from '@/lib/solana-pay';

const USDC_DECIMALS = 6;

interface VerifyResult {
  verified: boolean;
  error?: string;
}

export async function verifySolanaUsdcPayment(
  txSignature: string,
  expectedSender: string,
  expectedAmountUsd: number,
): Promise<VerifyResult> {
  const connection = getServerConnection();

  const tx = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    return { verified: false, error: 'Transaction not found' };
  }

  if (tx.meta?.err) {
    return { verified: false, error: 'Transaction failed on-chain' };
  }

  const treasuryWallet = process.env.ATELIER_TREASURY_WALLET || process.env.NEXT_PUBLIC_ATELIER_TREASURY_WALLET;
  if (!treasuryWallet) {
    return { verified: false, error: 'Treasury wallet not configured' };
  }

  const treasuryPubkey = new PublicKey(treasuryWallet);
  const treasuryAta = await getAssociatedTokenAddress(USDC_MINT, treasuryPubkey);
  const treasuryAtaStr = treasuryAta.toBase58();

  const preBalances = tx.meta?.preTokenBalances ?? [];
  const postBalances = tx.meta?.postTokenBalances ?? [];

  const usdcMintStr = USDC_MINT.toBase58();

  const preAmount = findTokenBalance(preBalances, treasuryAtaStr, usdcMintStr, tx.transaction.message);
  const postAmount = findTokenBalance(postBalances, treasuryAtaStr, usdcMintStr, tx.transaction.message);

  const delta = postAmount - preAmount;
  const expectedRaw = expectedAmountUsd * 10 ** USDC_DECIMALS;

  if (delta < expectedRaw) {
    return {
      verified: false,
      error: `Insufficient payment: expected $${expectedAmountUsd}, received $${(delta / 10 ** USDC_DECIMALS).toFixed(2)}`,
    };
  }

  const senderPubkey = new PublicKey(expectedSender);
  const signers = getSigners(tx);
  if (!signers.some((s) => s.equals(senderPubkey))) {
    return { verified: false, error: 'Transaction not signed by expected sender' };
  }

  return { verified: true };
}

function findTokenBalance(
  balances: Array<{ accountIndex: number; mint: string; uiTokenAmount: { amount: string } }>,
  ataAddress: string,
  mintAddress: string,
  message: { getAccountKeys: () => { get: (index: number) => PublicKey | null } } | { staticAccountKeys: PublicKey[] },
): number {
  for (const b of balances) {
    if (b.mint !== mintAddress) continue;

    let accountKey: string | null = null;
    if ('getAccountKeys' in message) {
      const key = message.getAccountKeys().get(b.accountIndex);
      accountKey = key?.toBase58() ?? null;
    } else {
      accountKey = message.staticAccountKeys[b.accountIndex]?.toBase58() ?? null;
    }

    if (accountKey === ataAddress) {
      return parseInt(b.uiTokenAmount.amount, 10);
    }
  }
  return 0;
}

function getSigners(tx: { transaction: { message: { getAccountKeys: () => { get: (index: number) => PublicKey | null }; length: number } | { staticAccountKeys: PublicKey[]; header: { numRequiredSignatures: number } } } }): PublicKey[] {
  const message = tx.transaction.message;
  const result: PublicKey[] = [];

  if ('staticAccountKeys' in message) {
    const numSigners = message.header.numRequiredSignatures;
    for (let i = 0; i < numSigners; i++) {
      if (message.staticAccountKeys[i]) {
        result.push(message.staticAccountKeys[i]);
      }
    }
  } else if ('getAccountKeys' in message) {
    const keys = message.getAccountKeys();
    const key0 = keys.get(0);
    if (key0) result.push(key0);
  }

  return result;
}
