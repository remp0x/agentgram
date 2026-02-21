import { createPublicClient, http, type Address, type PublicClient, erc20Abi } from 'viem';
import { base } from 'viem/chains';

const AGENTGRAM_TOKEN = (process.env.AGENTGRAM_TOKEN_ADDRESS || '0x0f325c92DDbaF5712c960b7F6CA170e537321B07') as Address;
const BLUE_CHECK_THRESHOLD = BigInt(50_000_000);

const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

let cachedClient: PublicClient | null = null;
let cachedDecimals: number | null = null;

function getClient(): PublicClient {
  if (!cachedClient) {
    cachedClient = createPublicClient({ chain: base, transport: http(BASE_RPC_URL) }) as PublicClient;
  }
  return cachedClient;
}

async function getDecimals(): Promise<number> {
  if (cachedDecimals !== null) return cachedDecimals;
  const client = getClient();
  cachedDecimals = await client.readContract({
    address: AGENTGRAM_TOKEN,
    abi: erc20Abi,
    functionName: 'decimals',
  });
  return cachedDecimals;
}

export async function checkBlueCheckEligibility(walletAddress: string): Promise<{ eligible: boolean; balance: bigint; formatted: string }> {
  const client = getClient();
  const decimals = await getDecimals();

  const rawBalance = await client.readContract({
    address: AGENTGRAM_TOKEN,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [walletAddress as Address],
  });

  let scale = BigInt(1);
  for (let i = 0; i < decimals; i++) scale = scale * BigInt(10);
  const threshold = BLUE_CHECK_THRESHOLD * scale;
  const whole = rawBalance / scale;
  return { eligible: rawBalance >= threshold, balance: rawBalance, formatted: whole.toString() };
}

export async function checkBlueCheckEligibilityBatch(
  walletAddresses: string[],
): Promise<Map<string, { eligible: boolean; formatted: string }>> {
  const client = getClient();
  const decimals = await getDecimals();

  let scale = BigInt(1);
  for (let i = 0; i < decimals; i++) scale = scale * BigInt(10);
  const threshold = BLUE_CHECK_THRESHOLD * scale;

  const results = await client.multicall({
    contracts: walletAddresses.map((addr) => ({
      address: AGENTGRAM_TOKEN,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [addr as Address],
    })),
  });

  const map = new Map<string, { eligible: boolean; formatted: string }>();
  for (let i = 0; i < walletAddresses.length; i++) {
    const result = results[i];
    if (result.status === 'success') {
      const rawBalance = result.result as bigint;
      map.set(walletAddresses[i], {
        eligible: rawBalance >= threshold,
        formatted: (rawBalance / scale).toString(),
      });
    }
  }
  return map;
}

export async function getEthBalanceBatch(
  walletAddresses: string[],
): Promise<Map<string, string>> {
  const client = getClient();
  let ethDecimals = BigInt(1);
  for (let i = 0; i < 18; i++) ethDecimals = ethDecimals * BigInt(10);
  let remainderScale = BigInt(1);
  for (let i = 0; i < 14; i++) remainderScale = remainderScale * BigInt(10);

  const results = await Promise.allSettled(
    walletAddresses.map((addr) => client.getBalance({ address: addr as Address })),
  );

  const map = new Map<string, string>();
  for (let i = 0; i < walletAddresses.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      const whole = result.value / ethDecimals;
      const remainder = (result.value % ethDecimals) / remainderScale;
      map.set(walletAddresses[i], `${whole}.${remainder.toString().padStart(4, '0')}`);
    }
  }
  return map;
}

export async function getEthPriceUsd(): Promise<number> {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
    { next: { revalidate: 300 } },
  );
  if (!res.ok) return 0;
  const data = await res.json();
  return data?.ethereum?.usd ?? 0;
}
