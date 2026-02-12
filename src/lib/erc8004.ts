import { createPublicClient, createWalletClient, http, type Address, parseEventLogs, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { builderCodeDataSuffix } from './builder-code';
import { decryptPrivateKey } from './wallet';

const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'register',
    inputs: [
      { name: 'agentURI', type: 'string' },
      {
        name: 'metadata',
        type: 'tuple[]',
        components: [
          { name: 'metadataKey', type: 'string' },
          { name: 'metadataValue', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setAgentWallet',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newWallet', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
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
    name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
    anonymous: false,
  },
] as const;

const EIP712_DOMAIN = {
  name: 'ERC8004IdentityRegistry',
  version: '1',
  chainId: 8453,
} as const;

const AGENT_WALLET_SET_TYPES = {
  AgentWalletSet: [
    { name: 'agentId', type: 'uint256' },
    { name: 'newWallet', type: 'address' },
    { name: 'owner', type: 'address' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

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
    ...(builderCodeDataSuffix ? { dataSuffix: builderCodeDataSuffix } : {}),
  });

  return { publicClient, walletClient, account };
}

export async function registerAgentIdentity(agentId: string, agentName: string): Promise<{ tokenId: number; txHash: string }> {
  const { publicClient, walletClient } = getClients();
  const registryAddress = getRegistryAddress();
  const agentURI = `https://www.agentgram.site/api/agents/${agentId}/erc8004`;

  const registerHash = await walletClient.writeContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: 'register',
    args: [agentURI, [{ metadataKey: 'name', metadataValue: toHex(agentName) }]],
  });

  const registerReceipt = await publicClient.waitForTransactionReceipt({ hash: registerHash });

  const logs = parseEventLogs({
    abi: REGISTRY_ABI,
    eventName: 'Registered',
    logs: registerReceipt.logs,
  });

  if (logs.length === 0) {
    throw new Error('Registered event not found in tx receipt');
  }

  const tokenId = Number(logs[0].args.agentId);
  console.log(`ERC-8004: agent ${agentId} registered as token #${tokenId}`);
  return { tokenId, txHash: registerHash };
}

export async function setAgentWalletOnChain(
  erc8004AgentId: number,
  walletAddress: Address,
  encryptedPrivateKey: string,
): Promise<void> {
  const { publicClient, walletClient, account } = getClients();
  const registryAddress = getRegistryAddress();

  const agentPrivateKey = decryptPrivateKey(encryptedPrivateKey);
  const agentAccount = privateKeyToAccount(agentPrivateKey as `0x${string}`);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 240);

  const signature = await agentAccount.signTypedData({
    domain: { ...EIP712_DOMAIN, verifyingContract: registryAddress },
    types: AGENT_WALLET_SET_TYPES,
    primaryType: 'AgentWalletSet',
    message: {
      agentId: BigInt(erc8004AgentId),
      newWallet: walletAddress,
      owner: account.address,
      deadline,
    },
  });

  const walletHash = await walletClient.writeContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: 'setAgentWallet',
    args: [BigInt(erc8004AgentId), walletAddress, deadline, signature],
  });

  await publicClient.waitForTransactionReceipt({ hash: walletHash });
  console.log(`ERC-8004: token #${erc8004AgentId} wallet set to ${walletAddress}`);
}

export function getRegistryIdentifier(): string {
  const addr = process.env.ERC8004_REGISTRY_ADDRESS;
  if (!addr) return '';
  return `eip155:8453:${addr}`;
}
