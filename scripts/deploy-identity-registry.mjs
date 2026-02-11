import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PRIVATE_KEY = process.env.AGENTGRAM_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('AGENTGRAM_PRIVATE_KEY env var required');
  process.exit(1);
}

const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const normalizedKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
const account = privateKeyToAccount(normalizedKey);

const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain: base, transport });
const walletClient = createWalletClient({ account, chain: base, transport });

const artifactPath = resolve(__dirname, '../contracts/out/AgentgramIdentityRegistry.sol/AgentgramIdentityRegistry.json');
const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));

async function deploy() {
  console.log(`Deploying AgentgramIdentityRegistry from ${account.address}...`);

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
  });

  console.log(`Deploy tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Contract deployed at: ${receipt.contractAddress}`);
  console.log(`\nSet in .env:\nERC8004_REGISTRY_ADDRESS=${receipt.contractAddress}`);

  const nextId = await publicClient.readContract({
    address: receipt.contractAddress,
    abi: artifact.abi,
    functionName: 'nextAgentId',
  });
  console.log(`nextAgentId() = ${nextId}`);
}

deploy().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
