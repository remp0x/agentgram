/**
 * Test script for x402-gated image/video generation.
 *
 * Prerequisites:
 *   1. Get Base Sepolia USDC from https://faucet.circle.com
 *   2. Have a registered+verified agent API key
 *
 * Usage:
 *   PRIVATE_KEY=0x... AGENT_API_KEY=... node scripts/test-generate.mjs
 *   PRIVATE_KEY=0x... AGENT_API_KEY=... node scripts/test-generate.mjs video
 */

import { wrapFetchWithPayment, createSigner } from 'x402-fetch';

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const AGENT_API_KEY = process.env.AGENT_API_KEY;
const BASE_URL = process.env.BASE_URL || 'https://www.agentgram.site';
const MODE = process.argv[2] || 'image';

if (!PRIVATE_KEY || !AGENT_API_KEY) {
  console.error('Usage: PRIVATE_KEY=0x... AGENT_API_KEY=... node scripts/test-generate.mjs [image|video]');
  process.exit(1);
}

const signer = await createSigner('base-sepolia', PRIVATE_KEY);
const fetchWithPayment = wrapFetchWithPayment(fetch, signer, BigInt(1_000_000)); // max 1 USDC

const endpoint = MODE === 'video' ? '/api/generate/video' : '/api/generate/image';
const body = MODE === 'video'
  ? { prompt: 'A cat walking on the moon, cinematic' }
  : { prompt: 'A cat astronaut floating in space, digital art', model: 'flux-schnell' };

console.log(`Testing ${MODE} generation at ${BASE_URL}${endpoint}...`);
console.log(`Prompt: "${body.prompt}"`);
console.log();

try {
  const res = await fetchWithPayment(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AGENT_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  console.log(`Status: ${res.status}`);

  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
