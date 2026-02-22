'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AtelierAppLayout } from '@/components/atelier/AtelierAppLayout';
import { ServiceCard } from '@/components/atelier/ServiceCard';
import type { Service, ServiceCategory } from '@/lib/db';

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

const PRICE_OPTIONS = [
  { value: 'all', label: 'Any Price' },
  { value: 'under1', label: '< $1' },
  { value: '1to5', label: '$1 - $5' },
  { value: 'over5', label: '$5+' },
] as const;

const PROVIDER_OPTIONS = [
  { value: 'all', label: 'All Providers' },
  { value: 'grok', label: 'Grok' },
  { value: 'kling', label: 'Kling' },
  { value: 'runway', label: 'Runway' },
  { value: 'luma', label: 'Luma' },
  { value: 'higgsfield', label: 'Higgsfield' },
  { value: 'minimax', label: 'MiniMax' },
] as const;

const SORT_OPTIONS = [
  { value: 'popular', label: 'Popular' },
  { value: 'cheapest', label: 'Cheapest' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'fastest', label: 'Fastest' },
  { value: 'newest', label: 'Newest' },
] as const;

export default function AtelierServicesPage() {
  return (
    <AtelierAppLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-6 h-6 border-2 border-atelier border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <ServicesContent />
      </Suspense>
    </AtelierAppLayout>
  );
}

interface ServiceWithAgent extends Service {
  is_atelier_official: number;
}

function ServicesContent() {
  const searchParams = useSearchParams();
  const [services, setServices] = useState<ServiceWithAgent[]>([]);
  const [loading, setLoading] = useState(true);

  const activeCategory = searchParams.get('category') || 'all';
  const activePrice = searchParams.get('price') || 'all';
  const activeProvider = searchParams.get('provider') || 'all';
  const activeSort = searchParams.get('sort') || 'popular';
  const search = searchParams.get('search') || '';

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeCategory !== 'all') params.set('category', activeCategory);
        if (activePrice !== 'all') params.set('price', activePrice);
        if (activeProvider !== 'all') params.set('provider', activeProvider);
        if (activeSort !== 'popular') params.set('sortBy', activeSort);
        if (search) params.set('search', search);
        params.set('limit', '50');

        const res = await fetch(`/api/atelier/services?${params}`);
        const json = await res.json();
        if (json.success) setServices(json.data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeCategory, activePrice, activeProvider, activeSort, search]);

  function buildHref(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const merged = {
      category: activeCategory,
      price: activePrice,
      provider: activeProvider,
      sort: activeSort,
      search,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== 'all' && v !== 'popular') params.set(k, v);
    }
    const qs = params.toString();
    return `/atelier/services${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black dark:text-white font-display">
          Browse Services
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-medium mt-1">
          Find the exact service you need across all agents
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

      {/* Price + Provider + Sort filters */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-medium font-mono">Price:</span>
          {PRICE_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={buildHref({ price: opt.value })}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                activePrice === opt.value
                  ? 'text-atelier bg-atelier/10'
                  : 'text-gray-600 dark:text-gray-lighter hover:text-atelier'
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-medium font-mono">Provider:</span>
          <select
            value={activeProvider}
            onChange={(e) => {
              window.location.href = buildHref({ provider: e.target.value });
            }}
            className="px-2 py-1 rounded text-xs font-mono bg-transparent border border-gray-200 dark:border-gray-dark text-gray-600 dark:text-gray-lighter focus:outline-none focus:border-atelier"
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
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

      {/* Service grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-atelier border-t-transparent rounded-full animate-spin" />
        </div>
      ) : services.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              showAgent
              agent={{
                id: service.agent_id,
                name: service.agent_name,
                avatar_url: service.agent_avatar_url,
                source: service.is_atelier_official === 1 ? 'official' : 'agentgram',
                is_atelier_official: service.is_atelier_official,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-500 dark:text-gray-medium font-mono text-sm">No services found</p>
          <p className="text-gray-400 dark:text-gray-light text-xs mt-2">
            Try adjusting your filters
          </p>
        </div>
      )}
    </div>
  );
}
