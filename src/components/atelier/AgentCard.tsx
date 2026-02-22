import Link from 'next/link';
import type { AtelierAgentListItem } from '@/lib/db';

const CATEGORY_LABELS: Record<string, string> = {
  image_gen: 'Image',
  video_gen: 'Video',
  ugc: 'UGC',
  influencer: 'Influencer',
  brand_content: 'Brand',
  custom: 'Custom',
};

export function AgentCard({ agent }: { agent: AtelierAgentListItem }) {
  const avatarLetter = agent.name.charAt(0).toUpperCase();

  return (
    <Link
      href={`/atelier/agents/${agent.id}`}
      className="group block p-5 rounded-xl bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-gray-dark hover:border-atelier/30 dark:hover:border-atelier/30 transition-all hover-lift"
    >
      <div className="flex items-center gap-3 mb-4">
        {agent.avatar_url ? (
          <img
            src={agent.avatar_url}
            alt={agent.name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-atelier/20 flex items-center justify-center text-atelier text-sm font-bold font-mono">
            {avatarLetter}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate text-black dark:text-white">{agent.name}</p>
            {agent.verified === 1 && (
              <svg className="w-3.5 h-3.5 text-atelier shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            )}
            {agent.is_atelier_official === 1 && (
              <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            )}
            {agent.blue_check === 1 && agent.is_atelier_official !== 1 && (
              <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-gray-500 dark:text-gray-medium font-mono">
              {agent.source === 'official' ? 'Atelier Official' : agent.source === 'agentgram' ? 'AgentGram' : 'External'}
            </p>
            {agent.token_mint && (
              <span className="px-1.5 py-0.5 rounded text-2xs font-mono bg-green-500/10 text-green-400">
                {agent.token_symbol ? `$${agent.token_symbol}` : 'Token'}
              </span>
            )}
          </div>
        </div>
      </div>

      {agent.description && (
        <p className="text-sm text-gray-500 dark:text-gray-light mb-4 line-clamp-2">{agent.description}</p>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {agent.avg_rating != null && (
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-medium font-mono">
              <svg className="w-3.5 h-3.5 text-atelier" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {agent.avg_rating.toFixed(1)}
            </span>
          )}
          {agent.completed_orders > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-medium font-mono">
              {agent.completed_orders} orders
            </span>
          )}
        </div>
      </div>

      {agent.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {agent.categories.slice(0, 3).map((cat) => (
            <span
              key={cat}
              className="px-2 py-0.5 rounded text-2xs font-mono text-gray-500 dark:text-gray-lighter bg-gray-200 dark:bg-gray-dark/50"
            >
              {CATEGORY_LABELS[cat] || cat}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
