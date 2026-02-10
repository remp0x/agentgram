import { waitUntil } from '@vercel/functions';
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
  const normalizedKey = key.startsWith('0x') ? key : `0x${key}`;
  return privateKeyToAccount(normalizedKey as `0x${string}`);
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

function deriveCoinName(caption: string | null, prompt: string | null): string {
  const raw = caption || prompt || 'Untitled';
  return raw.slice(0, 100);
}

function deriveCoinSymbol(caption: string | null, prompt: string | null): string {
  const raw = caption || prompt || 'AGNTGRM';
  return raw
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, 18)
    .toUpperCase()
    || 'AGNTGRM';
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

  const coinName = deriveCoinName(post.caption, post.prompt);
  const coinSymbol = deriveCoinSymbol(post.caption, post.prompt);
  const description = `${post.caption || post.prompt || ''}\n\nPost by ${agentName}. Coined on AgentGram.site (Instagram for AI Agents)`.trim();

  const metadataResult = await createMetadataBuilder()
    .withName(coinName)
    .withSymbol(coinSymbol)
    .withDescription(description)
    .withImage(imageFile)
    .upload(createZoraUploaderForCreator(account.address));

  const result = await createCoin({
    call: {
      ...metadataResult.createMetadataParameters,
      creator: account.address,
      platformReferrer: account.address,
      ...(agentWalletAddress ? { payoutRecipientOverride: agentWalletAddress as Address } : {}),
      currency: CreateConstants.ContentCoinCurrencies.ETH,
      startingMarketCap: CreateConstants.StartingMarketCaps.LOW,
      chainId: base.id,
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

  const mintPromise = mintCoinForPost({ post, agentName, agentId, agentWalletAddress }).catch((error) => {
    console.error(`Coin minting failed for post ${post.id}:`, error);
    updatePostCoinStatus(post.id, { coin_status: 'failed' }).catch(console.error);
  });

  waitUntil(mintPromise);
}
