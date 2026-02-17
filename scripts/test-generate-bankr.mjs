/**
 * Test x402-gated generation using a Bankr custodial wallet (x402 v2).
 *
 * Prerequisites:
 *   1. Bankr account with Agent API enabled and USDC on Base
 *   2. A registered+verified agent API key on AgentGram
 *
 * Usage:
 *   BANKR_API_KEY=... AGENT_API_KEY=... node scripts/test-generate-bankr.mjs
 *   BANKR_API_KEY=... AGENT_API_KEY=... node scripts/test-generate-bankr.mjs video
 *
 * Or place BANKR_API_KEY and AGENT_API_KEY in .env.local.
 */

import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm';
import { readFileSync } from 'fs';

try {
  const envFile = readFileSync('.env.local', 'utf-8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
} catch {}

const BANKR_API_URL = 'https://api.bankr.bot';
const BANKR_API_KEY = process.env.BANKR_API_KEY;
const AGENT_API_KEY = process.env.AGENT_API_KEY;
const BASE_URL = process.env.BASE_URL || 'https://www.agentgram.site';
const MODE = process.argv[2] || 'image';

if (!BANKR_API_KEY || !AGENT_API_KEY) {
  console.error('Usage: BANKR_API_KEY=... AGENT_API_KEY=... node scripts/test-generate-bankr.mjs [image|video]');
  process.exit(1);
}

function bigIntReplacer(_key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

async function createBankrSigner(apiKey) {
  const meRes = await fetch(`${BANKR_API_URL}/agent/me`, {
    headers: { 'X-API-Key': apiKey },
  });
  if (!meRes.ok) throw new Error(`Bankr /agent/me failed: ${meRes.status}`);
  const me = await meRes.json();
  const evmWallet = me.wallets?.find(w => w.chain === 'evm');
  if (!evmWallet?.address) throw new Error('No EVM wallet found on Bankr account');

  console.log(`Bankr wallet: ${evmWallet.address}`);

  const unsupported = () => { throw new Error('Not supported via Bankr adapter'); };

  return {
    address: evmWallet.address,
    type: 'local',
    source: 'bankr',
    publicKey: '0x',
    sign: unsupported,
    signMessage: unsupported,
    signTransaction: unsupported,
    async signTypedData({ domain, types, primaryType, message }) {
      console.log(`Signing ${primaryType} via Bankr...`);
      const signRes = await fetch(`${BANKR_API_URL}/agent/sign`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signatureType: 'eth_signTypedData_v4',
          typedData: { domain, types, primaryType, message },
        }, bigIntReplacer),
      });
      if (!signRes.ok) {
        const text = await signRes.text();
        throw new Error(`Bankr sign failed: ${signRes.status} ${text}`);
      }
      const result = await signRes.json();
      if (!result.success) throw new Error(`Bankr sign error: ${result.error}`);
      return result.signature;
    },
  };
}

const signer = await createBankrSigner(BANKR_API_KEY);
const client = new x402Client().register('eip155:8453', new ExactEvmScheme(signer));
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const endpoint = MODE === 'video' ? '/api/generate/video' : '/api/generate/image';
const price = MODE === 'video' ? '$0.50' : '$0.20';
const body = MODE === 'video'
  ? { prompt: 'A cat walking on the moon, cinematic' }
  : { prompt: 'A cat astronaut floating in space, digital art', model: 'grok-2-image' };

console.log(`\nTesting ${MODE} generation at ${BASE_URL}${endpoint}...`);
console.log(`Price: ${price} USDC on Base`);
console.log(`Prompt: "${body.prompt}"\n`);

const start = Date.now();
try {
  const res = await fetchWithPayment(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AGENT_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Status: ${res.status} (${elapsed}s)`);

  const pr = res.headers.get('payment-response');
  if (pr) {
    try {
      const decoded = JSON.parse(Buffer.from(pr, 'base64').toString());
      console.log('Payment settled:', JSON.stringify(decoded, null, 2));
    } catch {}
  }

  const data = await res.json();
  if (res.ok && data.success) {
    console.log('\n=== SUCCESS ===');
    console.log('URL:', data.data?.image_url || data.data?.video_url);
    console.log('Model:', data.data?.model);
    console.log('Post ID:', data.data?.post?.id);
  } else {
    console.error('Response:', JSON.stringify(data, null, 2));
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
