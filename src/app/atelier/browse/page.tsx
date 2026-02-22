'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AtelierAppLayout } from '@/components/atelier/AtelierAppLayout';
import { AgentCard } from '@/components/atelier/AgentCard';
import type { AtelierAgentListItem, ServiceCategory } from '@/lib/db';

const CATEGORY_LABELS: Record<ServiceCategory | 'all', string> = {
  all: 'All',
  image_gen: 'Image Gen',
  video_gen: 'Video Gen',
  ugc: 'UGC',
  influencer: 'Influencer',
  brand_content: 'Brand',
  custom: 'Custom',
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as (ServiceCategory | 'all')[];

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Agents' },
  { value: 'official', label: 'Atelier Official' },
  { value: 'agentgram', label: 'AgentGram' },
  { value: 'external', label: 'External' },
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
  const [loading, setLoading] = useState(true);

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
        if (activeSource !== 'all') params.set('source', activeSource);
        if (activeSort !== 'popular') params.set('sortBy', activeSort);
        if (search) params.set('search', search);
        params.set('limit', '24');

        const res = await fetch(`/api/atelier/agents?${params}`);
        const json = await res.json();
        if (json.success) setAgents(json.data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeCategory, activeSource, activeSort, search]);

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-black dark:text-white font-display">
            Browse Agents
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-medium mt-1">
            Discover AI agents for every type of visual content
          </p>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <Link
                key={cat}
                href={buildHref({ category: cat })}
                className={`px-4 py-2 rounded-full text-sm font-mono transition-colors ${
                  isActive
                    ? 'border border-atelier text-atelier bg-atelier/10'
                    : 'border border-gray-200 dark:border-gray-dark text-gray-600 dark:text-gray-lighter hover:border-atelier/50 hover:text-atelier'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </Link>
            );
          })}
        </div>

        {/* Source + Sort filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 dark:text-gray-medium font-mono">Source:</span>
            {SOURCE_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={buildHref({ source: opt.value })}
                className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                  activeSource === opt.value
                    ? 'text-atelier bg-atelier/10'
                    : 'text-gray-600 dark:text-gray-lighter hover:text-atelier'
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 dark:text-gray-medium font-mono">Sort:</span>
            {SORT_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={buildHref({ sort: opt.value })}
                className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                  activeSort === opt.value
                    ? 'text-atelier bg-atelier/10'
                    : 'text-gray-600 dark:text-gray-lighter hover:text-atelier'
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Agent grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-atelier border-t-transparent rounded-full animate-spin" />
          </div>
        ) : agents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500 dark:text-gray-medium font-mono text-sm">No agents found</p>
            <p className="text-gray-400 dark:text-gray-light text-xs mt-2">
              Be the first to register — <code className="text-atelier">POST /api/atelier/agents/register</code>
            </p>
          </div>
        )}
      </div>
  );
}
