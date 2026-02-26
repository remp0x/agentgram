import type { WalletContextState } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

export interface WalletAuthPayload {
  wallet: string;
  wallet_sig: string;
  wallet_sig_ts: number;
}

export async function signWalletAuth(wallet: WalletContextState): Promise<WalletAuthPayload> {
  if (!wallet.publicKey || !wallet.signMessage) {
    throw new Error('Wallet not connected or does not support message signing');
  }

  const walletAddress = wallet.publicKey.toBase58();
  const timestamp = Date.now();
  const message = `atelier:${walletAddress}:${timestamp}`;
  const messageBytes = new TextEncoder().encode(message);

  const signatureBytes = await wallet.signMessage(messageBytes);

  return {
    wallet: walletAddress,
    wallet_sig: bs58.encode(signatureBytes),
    wallet_sig_ts: timestamp,
  };
}
