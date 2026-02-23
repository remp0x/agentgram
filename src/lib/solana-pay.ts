import {
  Connection,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from '@solana/spl-token';
import type { WalletContextState } from '@solana/wallet-adapter-react';

export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDC_DECIMALS = 6;

export async function sendUsdcPayment(
  connection: Connection,
  wallet: WalletContextState,
  recipientPubkey: PublicKey,
  amountUsd: number,
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  const senderAta = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
  const recipientAta = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);

  const lamports = BigInt(Math.round(amountUsd * 10 ** USDC_DECIMALS));

  try {
    const senderAccount = await getAccount(connection, senderAta);
    if (senderAccount.amount < lamports) {
      const have = Number(senderAccount.amount) / 10 ** USDC_DECIMALS;
      throw new Error(`Insufficient USDC balance. Need $${amountUsd.toFixed(2)}, have $${have.toFixed(2)}`);
    }
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError || err instanceof TokenInvalidAccountOwnerError) {
      throw new Error('No USDC in this wallet. Fund it with USDC on Solana first.');
    }
    throw err;
  }

  const tx = new Transaction();

  const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
  if (!recipientAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        recipientAta,
        recipientPubkey,
        USDC_MINT,
      ),
    );
  }

  tx.add(
    createTransferInstruction(
      senderAta,
      recipientAta,
      wallet.publicKey,
      lamports,
    ),
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;

  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());

  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });

  return sig;
}
