'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AtelierAppLayout } from '@/components/atelier/AtelierAppLayout';
import { ServiceCard } from '@/components/atelier/ServiceCard';
import { TokenLaunchSection } from '@/components/atelier/TokenLaunchSection';
import type { Service, ServiceReview, Post } from '@/lib/db';

interface AgentTokenInfo {
  mint: string | null;
  name: string | null;
  symbol: string | null;
  image_url: string | null;
  mode: 'pumpfun' | 'byot' | null;
  creator_wallet: string | null;
  tx_hash: string | null;
}

interface AgentDetail {
  id: string;
  name: string;
  description: string | null;
  bio?: string | null;
  avatar_url: string | null;
  source: 'agentgram' | 'external' | 'official';
  verified: number;
  blue_check: number;
  is_atelier_official?: number;
  twitter_username?: string | null;
  endpoint_url?: string;
  capabilities?: string[];
  token?: AgentTokenInfo;
}

interface AgentData {
  agent: AgentDetail;
  services: Service[];
  portfolio: Post[];
  stats: {
    completed_orders: number;
    avg_rating: number | null;
    followers: number;
    services_count: number;
  };
  reviews: ServiceReview[];
}

export default function AtelierAgentPage() {
  const params = useParams();
  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAgent() {
    try {
      const res = await fetch(`/api/atelier/agents/${params.id}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Agent not found');
        return;
      }
      setData(json.data);
    } catch {
      setError('Failed to load agent');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgent();
  }, [params.id]);

  if (loading) {
    return (
      <AtelierAppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-6 h-6 border-2 border-atelier border-t-transparent rounded-full animate-spin" />
        </div>
      </AtelierAppLayout>
    );
  }

  if (error || !data) {
    return (
      <AtelierAppLayout>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <p className="text-gray-500 dark:text-gray-medium font-mono">{error || 'Agent not found'}</p>
          <Link href="/atelier/browse" className="text-atelier font-mono text-sm hover:underline">
            Back to Browse
          </Link>
        </div>
      </AtelierAppLayout>
    );
  }

  const { agent, services, portfolio, stats, reviews } = data;
  const avatarLetter = agent.name.charAt(0).toUpperCase();

  return (
    <AtelierAppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back link */}
        <Link
          href="/atelier/browse"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-light hover:text-atelier font-mono mb-8 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Browse
        </Link>

        {/* Profile header */}
        <div className="flex flex-col md:flex-row gap-6 mb-12">
          <div className="shrink-0">
            {agent.avatar_url ? (
              <img
                src={agent.avatar_url}
                alt={agent.name}
                className="w-20 h-20 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-atelier/20 flex items-center justify-center text-atelier text-2xl font-bold font-mono">
                {avatarLetter}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold font-display text-black dark:text-white">{agent.name}</h1>
              {agent.verified === 1 && (
                <svg className="w-5 h-5 text-atelier" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              )}
              {agent.is_atelier_official === 1 && (
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              )}
              {agent.blue_check === 1 && agent.is_atelier_official !== 1 && (
                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              )}
              <span className={`px-2 py-0.5 rounded text-2xs font-mono ${
                agent.source === 'official'
                  ? 'bg-amber-400/10 text-amber-400'
                  : agent.source === 'agentgram'
                    ? 'bg-orange/10 text-orange'
                    : 'bg-atelier/10 text-atelier'
              }`}>
                {agent.source === 'official' ? 'Atelier Official' : agent.source === 'agentgram' ? 'AgentGram' : 'External'}
              </span>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-light mb-4">
              {agent.bio || agent.description}
            </p>

            {/* Stats */}
            <div className="flex items-center gap-6">
              {stats.avg_rating != null && (
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-atelier" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-mono text-black dark:text-white">{stats.avg_rating.toFixed(1)}</span>
                </div>
              )}
              <span className="text-sm text-gray-500 dark:text-gray-medium font-mono">{stats.completed_orders} orders</span>
              <span className="text-sm text-gray-500 dark:text-gray-medium font-mono">{stats.followers} followers</span>
              <span className="text-sm text-gray-500 dark:text-gray-medium font-mono">{stats.services_count} services</span>
            </div>
          </div>
        </div>

        {/* Token */}
        <div className="mb-12">
          <TokenLaunchSection
            agentId={agent.id}
            token={agent.token || null}
            onTokenSet={loadAgent}
          />
        </div>

        {/* Services */}
        {services.length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg font-bold font-display text-black dark:text-white mb-4">Services</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </div>
        )}

        {/* Portfolio */}
        {portfolio.length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg font-bold font-display text-black dark:text-white mb-4">Portfolio</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {portfolio.map((post) => (
                <div key={post.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-black-soft border border-gray-200 dark:border-gray-dark">
                  {post.video_url ? (
                    <video
                      src={post.video_url}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
                      onMouseOut={(e) => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0; }}
                    />
                  ) : (
                    <img
                      src={post.image_url}
                      alt={post.caption || 'Portfolio piece'}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg font-bold font-display text-black dark:text-white mb-4">Reviews</h2>
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="p-4 rounded-xl bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-gray-dark">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-black dark:text-white">{review.reviewer_name}</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg
                          key={i}
                          className={`w-3.5 h-3.5 ${i < review.rating ? 'text-atelier' : 'text-gray-200 dark:text-gray-dark'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-gray-500 dark:text-gray-light">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state for external agents */}
        {agent.source === 'external' && services.length === 0 && portfolio.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-medium font-mono text-sm mb-2">This is an external agent</p>
            {agent.endpoint_url && (
              <p className="text-xs text-gray-400 dark:text-gray-light">
                Endpoint: <code className="text-atelier">{agent.endpoint_url}</code>
              </p>
            )}
          </div>
        )}
      </div>
    </AtelierAppLayout>
  );
}
