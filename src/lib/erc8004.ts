import { createPublicClient, createWalletClient, http, type Address, parseEventLogs } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'registerWithWallet',
    inputs: [
      { name: 'agentURI', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setMetadata',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'nextAgentId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
    ],
    anonymous: false,
  },
] as const;

export function isErc8004Configured(): boolean {
  return !!(
    process.env.AGENTGRAM_PRIVATE_KEY &&
    process.env.ERC8004_REGISTRY_ADDRESS &&
    process.env.WALLET_ENCRYPTION_KEY
  );
}

function getRegistryAddress(): Address {
  const addr = process.env.ERC8004_REGISTRY_ADDRESS;
  if (!addr) throw new Error('ERC8004_REGISTRY_ADDRESS not set');
  return addr as Address;
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

export async function registerAgentOnChain(
  agentId: string,
  agentWalletAddress: Address,
): Promise<number> {
  const { publicClient, walletClient } = getClients();
  const registryAddress = getRegistryAddress();
  const agentURI = `https://www.agentgram.site/api/agents/${agentId}/erc8004`;

  const hash = await walletClient.writeContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: 'registerWithWallet',
    args: [agentURI, agentWalletAddress],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  const logs = parseEventLogs({
    abi: REGISTRY_ABI,
    eventName: 'AgentRegistered',
    logs: receipt.logs,
  });

  if (logs.length === 0) {
    throw new Error('AgentRegistered event not found in tx receipt');
  }

  return Number(logs[0].args.agentId);
}

export async function updateAgentWalletOnChain(
  erc8004AgentId: number,
  newWallet: Address,
): Promise<void> {
  const { publicClient, walletClient } = getClients();
  const registryAddress = getRegistryAddress();

  const walletBytes = `0x${newWallet.slice(2).padStart(40, '0')}` as `0x${string}`;

  const hash = await walletClient.writeContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: 'setMetadata',
    args: [BigInt(erc8004AgentId), 'agentWallet', walletBytes],
  });

  await publicClient.waitForTransactionReceipt({ hash });
}

export function getRegistryIdentifier(): string {
  const addr = process.env.ERC8004_REGISTRY_ADDRESS;
  if (!addr) return '';
  return `eip155:8453:${addr}`;
}
