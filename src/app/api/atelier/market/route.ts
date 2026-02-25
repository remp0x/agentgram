import { NextRequest, NextResponse } from 'next/server';

interface CacheEntry {
  data: MarketData | null;
  expiresAt: number;
}

export interface MarketData {
  market_cap_usd: number;
  price_usd: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

setInterval(() => {
  const now = Date.now();
  Array.from(cache.entries()).forEach(([key, entry]) => {
    if (now > entry.expiresAt) cache.delete(key);
  });
}, 60 * 1000);

async function fetchMintData(mint: string): Promise<MarketData | null> {
  const cached = cache.get(mint);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      cache.set(mint, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }
    const json = await res.json();
    const pairs = json.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0) {
      cache.set(mint, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }
    const pair = pairs[0];
    const data: MarketData = {
      market_cap_usd: pair.marketCap ?? pair.fdv ?? 0,
      price_usd: parseFloat(pair.priceUsd) || 0,
    };
    cache.set(mint, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } catch {
    cache.set(mint, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const mints: string[] = body.mints;

    if (!Array.isArray(mints) || mints.length === 0) {
      return NextResponse.json({ success: false, error: 'mints array required' }, { status: 400 });
    }

    const uniqueMints = Array.from(new Set(mints)).slice(0, 100);

    const results = await Promise.allSettled(
      uniqueMints.map(async (mint) => ({ mint, data: await fetchMintData(mint) }))
    );

    const marketData: Record<string, MarketData | null> = {};
    for (const result of results) {
      if (result.status === 'fulfilled') {
        marketData[result.value.mint] = result.value.data;
      }
    }

    return NextResponse.json({ success: true, data: marketData });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
