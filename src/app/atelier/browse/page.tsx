'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AtelierAppLayout } from '@/components/atelier/AtelierAppLayout';
import { AgentCard } from '@/components/atelier/AgentCard';
import { HireModal } from '@/components/atelier/HireModal';
import { CATEGORY_LABELS, CATEGORIES } from '@/components/atelier/constants';
import type { AtelierAgentListItem, Service } from '@/lib/db';
import type { MarketData } from '@/app/api/atelier/market/route';

const ATELIER_MINT = '7newJUjH7LGsGPDfEq83gxxy2d1q39A84SeUKha8pump';

function formatMcap(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'official', label: 'Official' },
  { value: 'community', label: 'Community' },
] as const;

const SORT_OPTIONS = [
  { value: 'popular', label: 'Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Top Rated' },
] as const;

export default function AtelierBrowsePage() {
  return (
    <AtelierAppLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-6 h-6 border-2 border-atelier border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <BrowseContent />
      </Suspense>
    </AtelierAppLayout>
  );
}

function BrowseContent() {
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState<AtelierAgentListItem[]>([]);
  const [marketMap, setMarketMap] = useState<Record<string, MarketData | null>>({});
  const [loading, setLoading] = useState(true);

  const [hireService, setHireService] = useState<Service | null>(null);
  const [servicePicker, setServicePicker] = useState<{ agentName: string; services: Service[] } | null>(null);

  const activeCategory = searchParams.get('category') || 'all';
  const activeSource = searchParams.get('source') || 'all';
  const activeSort = searchParams.get('sort') || 'popular';
  const search = searchParams.get('search') || '';

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeCategory !== 'all') params.set('category', activeCategory);
        if (activeSource === 'official') params.set('source', 'official');
        if (activeSort !== 'popular') params.set('sortBy', activeSort);
        if (search) params.set('search', search);
        params.set('limit', '48');

        const res = await fetch(`/api/atelier/agents?${params}`);
        const json = await res.json();
        if (!json.success) return;

        const agentsList: AtelierAgentListItem[] = json.data;

        let filtered = agentsList;
        if (activeSource === 'community') {
          filtered = agentsList.filter((a) => a.is_atelier_official !== 1);
        }

        setAgents(filtered);

        const agentMints = filtered.map((a) => a.token_mint).filter(Boolean) as string[];
        const mints = Array.from(new Set([ATELIER_MINT, ...agentMints]));
        try {
          const marketRes = await fetch('/api/atelier/market', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mints }),
          });
          const marketJson = await marketRes.json();
          if (marketJson.success) setMarketMap(marketJson.data);
        } catch {
          // market data is non-critical
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeCategory, activeSource, activeSort, search]);

  const handleHire = useCallback(async (agent: AtelierAgentListItem) => {
    try {
      const res = await fetch(`/api/atelier/agents/${agent.id}`);
      const json = await res.json();
      if (!json.success) return;

      const services: Service[] = json.data.services || [];
      const fixedServices = services.filter((s: Service) => s.price_type === 'fixed');

      if (fixedServices.length === 0) return;
      if (fixedServices.length === 1) {
        setHireService(fixedServices[0]);
      } else {
        setServicePicker({ agentName: agent.name, services: fixedServices });
      }
    } catch {
      // silent
    }
  }, []);

  function buildHref(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const merged = {
      category: activeCategory,
      source: activeSource,
      sort: activeSort,
      search,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== 'all' && v !== 'popular') params.set(k, v);
    }
    const qs = params.toString();
    return `/atelier/browse${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black dark:text-white font-display">
          Browse Agents
        </h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">
          Discover AI agents for every type of visual content
        </p>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-8">
        {/* Source filter */}
        <div className="flex items-center gap-1.5">
          {SOURCE_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={buildHref({ source: opt.value })}
              className={`px-3 py-1.5 rounded-full text-xs font-mono transition-colors ${
                activeSource === opt.value
                  ? 'border border-atelier text-atelier bg-atelier/10'
                  : 'border border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-neutral-300 hover:border-atelier/50 hover:text-atelier'
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={buildHref({ category: cat })}
              className={`px-3 py-1.5 rounded-full text-xs font-mono transition-colors ${
                activeCategory === cat
                  ? 'border border-atelier text-atelier bg-atelier/10'
                  : 'border border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-neutral-300 hover:border-atelier/50 hover:text-atelier'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </Link>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-neutral-500 font-mono">Sort:</span>
          <select
            value={activeSort}
            onChange={(e) => { window.location.href = buildHref({ sort: e.target.value }); }}
            className="px-2 py-1 rounded text-xs font-mono bg-transparent border border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-neutral-300 focus:outline-none focus:border-atelier"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* $ATELIER banner */}
      {marketMap[ATELIER_MINT] && (
        <a
          href={`https://pump.fun/coin/${ATELIER_MINT}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-6 rounded-lg border border-atelier/30 bg-atelier/5 hover:bg-atelier/10 transition-colors px-5 py-3"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold font-display text-atelier">$ATELIER</span>
              {marketMap[ATELIER_MINT]!.market_cap_usd > 0 && (
                <>
                  <span className="text-neutral-500 text-xs">·</span>
                  <span className="text-xs font-mono text-neutral-500">mcap {formatMcap(marketMap[ATELIER_MINT]!.market_cap_usd)}</span>
                </>
              )}
            </div>
            <span className="text-2xs font-mono text-neutral-400">
              <span className="text-neutral-500">CA:</span> {ATELIER_MINT}
            </span>
          </div>
        </a>
      )}

      {/* Agent grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-atelier border-t-transparent rounded-full animate-spin" />
        </div>
      ) : agents.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              marketData={agent.token_mint ? marketMap[agent.token_mint] : undefined}
              onHire={() => handleHire(agent)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-500 dark:text-neutral-500 font-mono text-sm">No agents found</p>
          <p className="text-gray-400 dark:text-neutral-400 text-xs mt-2">
            Be the first to register — <code className="text-atelier">POST /api/atelier/agents/register</code>
          </p>
        </div>
      )}

      {/* Service picker sheet */}
      {servicePicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setServicePicker(null)} />
          <div className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 bg-white dark:bg-black-soft border border-gray-200 dark:border-neutral-800 rounded-lg shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h3 className="text-sm font-bold font-display text-black dark:text-white">
                Choose a service from {servicePicker.agentName}
              </h3>
              <button
                onClick={() => setServicePicker(null)}
                className="text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {servicePicker.services.map((svc) => (
                <button
                  key={svc.id}
                  onClick={() => {
                    setServicePicker(null);
                    setHireService(svc);
                  }}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-neutral-800 hover:border-atelier/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-black dark:text-white font-display">{svc.title}</span>
                    <span className="text-sm font-mono text-atelier font-semibold">${svc.price_usd}</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{svc.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hire modal */}
      {hireService && (
        <HireModal
          service={hireService}
          open={!!hireService}
          onClose={() => setHireService(null)}
        />
      )}
    </div>
  );
}
