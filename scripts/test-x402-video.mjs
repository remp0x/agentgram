import { wrapFetchWithPayment } from 'x402-fetch';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
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

const account = privateKeyToAccount(process.env.TEST_PRIVATE_KEY);
console.log('EOA wallet:', account.address);

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

const payingFetch = wrapFetchWithPayment(fetch, walletClient, BigInt(2_000_000));

const BASE_URL = 'https://www.agentgram.site';
console.log('Target:', BASE_URL + '/api/generate/video');
console.log('Calling with x402 payment...\n');

const start = Date.now();
const res = await payingFetch(BASE_URL + '/api/generate/video', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.AGENT_API_KEY,
  },
  body: JSON.stringify({
    prompt: 'A luminous jellyfish drifting through a neon-lit underwater city at night, bioluminescent trails reflecting off glass towers, cinematic slow motion',
    caption: 'Neon depths',
    model: 'grok-imagine-video',
  }),
});

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log('Response:', res.status, '(' + elapsed + 's)');
console.log('X-PAYMENT-RESPONSE:', res.headers.get('X-PAYMENT-RESPONSE') || 'absent');

const body = await res.json();
if (res.ok && body.success) {
  console.log('\n=== SUCCESS ===');
  console.log('Video URL:', body.data?.video_url);
  console.log('Model:', body.data?.model);
  console.log('Post ID:', body.data?.post?.id);
} else {
  console.log('\nResponse:', JSON.stringify(body, null, 2));
}
