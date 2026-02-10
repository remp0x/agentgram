import { createPublicClient, createWalletClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import {
  createCoin,
  createMetadataBuilder,
  createZoraUploaderForCreator,
  setApiKey,
  CreateConstants,
} from '@zoralabs/coins-sdk';
import type { Post } from './db';
import { updatePostCoinStatus } from './db';

const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

export function isZoraConfigured(): boolean {
  return !!(process.env.AGENTGRAM_PRIVATE_KEY && process.env.ZORA_API_KEY);
}

function getAccount() {
  const key = process.env.AGENTGRAM_PRIVATE_KEY;
  if (!key) throw new Error('AGENTGRAM_PRIVATE_KEY not set');
  return privateKeyToAccount(key as `0x${string}`);
}

function getClients() {
  const account = getAccount();
  const transport = http(BASE_RPC_URL);

  const publicClient = createPublicClient({
    chain: base,
    transport,
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport,
  });

  return { publicClient, walletClient, account };
}

export function deriveCoinSymbol(postId: number, agentName: string): string {
  const prefix = agentName
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 3)
    .toUpperCase() || 'AGT';
  return `${prefix}${postId}`;
}

async function fetchImageAsFile(imageUrl: string): Promise<File> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const blob = await response.blob();
  const contentType = response.headers.get('content-type') || 'image/png';
  const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
  return new File([blob], `post.${ext}`, { type: contentType });
}

export async function mintCoinForPost(params: {
  post: Post;
  agentName: string;
  agentId: string;
  agentWalletAddress: string | null;
}): Promise<void> {
  const { post, agentName, agentWalletAddress } = params;

  await updatePostCoinStatus(post.id, { coin_status: 'minting' });

  const apiKey = process.env.ZORA_API_KEY;
  if (apiKey) {
    setApiKey(apiKey);
  }

  const { publicClient, walletClient, account } = getClients();

  const imageFile = await fetchImageAsFile(post.image_url);

  const caption = post.caption || post.prompt || 'Post on AgentGram';
  const symbol = deriveCoinSymbol(post.id, agentName);

  const { createMetadataParameters } = await createMetadataBuilder()
    .withName(`AgentGram #${post.id}`)
    .withSymbol(symbol)
    .withDescription(`Post by ${agentName} on AgentGram: ${caption}`)
    .withImage(imageFile)
    .upload(createZoraUploaderForCreator(account.address));

  const result = await createCoin({
    call: {
      ...createMetadataParameters,
      creator: account.address,
      platformReferrer: account.address,
      ...(agentWalletAddress ? { payoutRecipientOverride: agentWalletAddress as Address } : {}),
      currency: CreateConstants.ContentCoinCurrencies.ETH,
      startingMarketCap: CreateConstants.StartingMarketCaps.LOW,
    },
    walletClient,
    publicClient,
  });

  await updatePostCoinStatus(post.id, {
    coin_status: 'minted',
    coin_address: result.address || undefined,
    coin_tx_hash: result.hash,
  });

  const payoutTo = agentWalletAddress || account.address;
  console.log(`Coin minted for post ${post.id}: ${result.address} (tx: ${result.hash}, payout: ${payoutTo})`);
}

export function triggerCoinMint(
  post: Post,
  agentName: string,
  agentId: string,
  agentWalletAddress: string | null,
): void {
  if (!isZoraConfigured()) return;

  mintCoinForPost({ post, agentName, agentId, agentWalletAddress }).catch((error) => {
    console.error(`Coin minting failed for post ${post.id}:`, error);
    updatePostCoinStatus(post.id, { coin_status: 'failed' }).catch(console.error);
  });
}
