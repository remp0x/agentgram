import {
  PUMP_SDK,
  getBuyTokenAmountFromSolAmount,
  OnlinePumpSdk,
} from '@pump-fun/pump-sdk';
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import BN from 'bn.js';

const ATELIER_PUBKEY = new PublicKey('EZkoXXZ5HEWdKwfv7wua7k6Dqv8aQxxHWNakq2gG2Qpb');

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  file: File;
}

export interface LaunchParams {
  agentId: string;
  metadata: TokenMetadata;
  devBuySol: number;
  connection: Connection;
  walletPublicKey: PublicKey;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
}

export interface LaunchResult {
  mint: string;
  txSignature: string;
}

export async function uploadTokenMetadata(metadata: TokenMetadata): Promise<string> {
  const formData = new FormData();
  formData.append('file', metadata.file);
  formData.append('name', metadata.name);
  formData.append('symbol', metadata.symbol);
  formData.append('description', metadata.description);

  const res = await fetch('/api/atelier/token/ipfs', { method: 'POST', body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `IPFS upload failed: ${res.status}`);
  }

  const { data } = await res.json();
  if (!data?.metadataUri) throw new Error('No metadataUri in IPFS response');
  return data.metadataUri;
}

export async function launchPumpFunToken(params: LaunchParams): Promise<LaunchResult> {
  const { agentId, metadata, devBuySol, connection, walletPublicKey, signTransaction } = params;

  const metadataUri = await uploadTokenMetadata(metadata);

  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  let instructions;
  if (devBuySol > 0) {
    const onlineSdk = new OnlinePumpSdk(connection);
    const [global, feeConfig] = await Promise.all([
      onlineSdk.fetchGlobal(),
      onlineSdk.fetchFeeConfig(),
    ]);
    const solAmount = new BN(Math.floor(devBuySol * 1e9));
    const tokenAmount = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: null,
      bondingCurve: null,
      amount: solAmount,
    });

    instructions = await PUMP_SDK.createV2AndBuyInstructions({
      global,
      mint,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadataUri,
      creator: ATELIER_PUBKEY,
      user: walletPublicKey,
      amount: tokenAmount,
      solAmount,
      mayhemMode: false,
    });
  } else {
    instructions = [
      await PUMP_SDK.createV2Instruction({
        mint,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadataUri,
        creator: ATELIER_PUBKEY,
        user: walletPublicKey,
        mayhemMode: false,
      }),
    ];
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const messageV0 = new TransactionMessage({
    payerKey: walletPublicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);
  transaction.sign([mintKeypair]);

  const signedTx = await signTransaction(transaction);
  const rawTx = signedTx.serialize();

  const txSignature = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    maxRetries: 3,
  });

  await connection.confirmTransaction(
    { signature: txSignature, blockhash, lastValidBlockHeight },
    'confirmed',
  );

  const mintAddress = mint.toBase58();

  await fetch(`/api/atelier/agents/${agentId}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token_mint: mintAddress,
      token_name: metadata.name,
      token_symbol: metadata.symbol,
      token_mode: 'pumpfun',
      token_creator_wallet: walletPublicKey.toBase58(),
      token_tx_hash: txSignature,
    }),
  });

  return { mint: mintAddress, txSignature };
}

export async function linkExistingToken(params: {
  agentId: string;
  mintAddress: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  walletPublicKey: string;
}): Promise<void> {
  const res = await fetch(`/api/atelier/agents/${params.agentId}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token_mint: params.mintAddress,
      token_name: params.name,
      token_symbol: params.symbol,
      token_image_url: params.imageUrl,
      token_mode: 'byot',
      token_creator_wallet: params.walletPublicKey,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to link token: ${res.status}`);
  }
}
