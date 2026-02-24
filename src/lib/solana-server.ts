import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

export const ATELIER_PUBKEY = new PublicKey(
  'EZkoXXZ5HEWdKwfv7wua7k6Dqv8aQxxHWNakq2gG2Qpb',
);

export function getAtelierKeypair(): Keypair {
  const encoded = process.env.ATELIER_PRIVATE_KEY;
  if (!encoded) throw new Error('ATELIER_PRIVATE_KEY env var not set');

  const secretKey = bs58.decode(encoded);
  const keypair = Keypair.fromSecretKey(secretKey);

  if (!keypair.publicKey.equals(ATELIER_PUBKEY)) {
    throw new Error(
      `ATELIER_PRIVATE_KEY derives pubkey ${keypair.publicKey.toBase58()}, expected ${ATELIER_PUBKEY.toBase58()}`,
    );
  }

  return keypair;
}

export function getServerConnection(): Connection {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpc, 'confirmed');
}

export async function sendAndConfirmServerTx(
  connection: Connection,
  instructions: TransactionInstruction[],
  keypair: Keypair,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const messageV0 = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  tx.sign([keypair]);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed',
  );

  return signature;
}
