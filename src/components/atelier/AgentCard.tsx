import Link from 'next/link';
import type { AtelierAgentListItem, ServiceCategory } from '@/lib/db';
import type { MarketData } from '@/app/api/atelier/market/route';
import { CATEGORY_LABELS } from './constants';

function formatMcap(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

interface AgentCardProps {
  agent: AtelierAgentListItem;
  marketData?: MarketData | null;
  onHire?: () => void;
}

export function AgentCard({ agent, marketData, onHire }: AgentCardProps) {
  const avatarLetter = agent.name.charAt(0).toUpperCase();
  const imageSrc = agent.token_image_url || agent.avatar_url;
  const primaryCategory = agent.categories[0];

  return (
    <div className="overflow-hidden rounded-lg bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-neutral-800 hover:border-atelier/40 dark:hover:border-atelier/40 transition-all duration-200 hover:shadow-lg hover:shadow-atelier/5 flex flex-col">
      {/* Image */}
      <Link href={`/atelier/agents/${agent.id}`} className="relative block aspect-square bg-neutral-900 overflow-hidden">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={agent.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-atelier/10">
            <span className="text-4xl font-bold font-display text-atelier/60">{avatarLetter}</span>
          </div>
        )}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2">
          {primaryCategory && (
            <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-semibold bg-black/60 text-white backdrop-blur-sm">
              {CATEGORY_LABELS[primaryCategory as ServiceCategory] || primaryCategory}
            </span>
          )}
          {agent.is_atelier_official === 1 && (
            <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-semibold bg-atelier text-white ml-auto">
              by ATELIER
            </span>
          )}
        </div>
      </Link>

      {/* Name + Ticker + Mcap */}
      <div className="px-3 pt-3 flex items-center justify-between gap-2">
        <Link href={`/atelier/agents/${agent.id}`} className="font-bold font-display text-sm text-black dark:text-white truncate hover:text-atelier transition-colors">
          {agent.name}
        </Link>
        {agent.token_symbol && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-mono font-semibold text-atelier">${agent.token_symbol}</span>
            {marketData && (
              <span className="text-2xs font-mono text-neutral-400">{formatMcap(marketData.market_cap_usd)}</span>
            )}
          </div>
        )}
      </div>

      {/* CA link */}
      {agent.token_mint && (
        <div className="px-3 pt-0.5">
          <a
            href={`https://pump.fun/coin/${agent.token_mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-2xs font-mono text-neutral-400 hover:text-atelier transition-colors"
          >
            {agent.token_mint.slice(0, 4)}...{agent.token_mint.slice(-4)}
          </a>
        </div>
      )}

      {/* Description */}
      {agent.description && (
        <p className="text-xs text-neutral-500 line-clamp-2 px-3 pt-1">{agent.description}</p>
      )}

      {/* Stats + Hire */}
      <div className="px-3 py-3 mt-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {agent.avg_rating != null && (
            <span className="flex items-center gap-1 text-xs text-neutral-500 font-mono">
              <svg className="w-3.5 h-3.5 text-atelier" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {agent.avg_rating.toFixed(1)}
            </span>
          )}
          {agent.completed_orders > 0 && (
            <span className="text-xs text-neutral-500 font-mono">
              {agent.completed_orders} orders
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            onHire?.();
          }}
          className="px-3 py-1 rounded-md bg-atelier text-white text-xs font-semibold font-mono button-press transition-colors hover:bg-atelier-bright"
        >
          Hire
        </button>
      </div>
    </div>
  );
}
