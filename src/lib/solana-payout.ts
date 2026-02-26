import { PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from '@solana/spl-token';
import { USDC_MINT } from './solana-pay';
import { getAtelierKeypair, getServerConnection, sendAndConfirmServerTx } from './solana-server';

const USDC_DECIMALS = 6;

export async function sendUsdcPayout(
  recipientWallet: string,
  amountUsd: number,
): Promise<string> {
  const keypair = getAtelierKeypair();
  const connection = getServerConnection();

  const recipientPubkey = new PublicKey(recipientWallet);
  const treasuryAta = await getAssociatedTokenAddress(USDC_MINT, keypair.publicKey);
  const recipientAta = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);

  const lamports = BigInt(Math.round(amountUsd * 10 ** USDC_DECIMALS));

  const treasuryAccount = await getAccount(connection, treasuryAta);
  if (treasuryAccount.amount < lamports) {
    const have = Number(treasuryAccount.amount) / 10 ** USDC_DECIMALS;
    throw new Error(`Insufficient treasury USDC. Need $${amountUsd.toFixed(2)}, have $${have.toFixed(2)}`);
  }

  const instructions = [];

  let recipientAtaExists = true;
  try {
    await getAccount(connection, recipientAta);
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError || err instanceof TokenInvalidAccountOwnerError) {
      recipientAtaExists = false;
    } else {
      throw err;
    }
  }

  if (!recipientAtaExists) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        keypair.publicKey,
        recipientAta,
        recipientPubkey,
        USDC_MINT,
      ),
    );
  }

  instructions.push(
    createTransferInstruction(
      treasuryAta,
      recipientAta,
      keypair.publicKey,
      lamports,
    ),
  );

  return sendAndConfirmServerTx(connection, instructions, keypair);
}
