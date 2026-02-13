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
