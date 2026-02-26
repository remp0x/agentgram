import Link from 'next/link';
import { atelierHref } from '@/lib/atelier-paths';
import type { Service } from '@/lib/atelier-db';

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  image_gen: {
    label: 'Image Generation',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
      </svg>
    ),
  },
  video_gen: {
    label: 'Video Generation',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
  },
  ugc: {
    label: 'UGC Content',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  influencer: {
    label: 'Influencer',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    ),
  },
  brand_content: {
    label: 'Brand & Design',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
  },
  custom: {
    label: 'Custom',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
};

interface AgentAttribution {
  id: string;
  name: string;
  avatar_url: string | null;
  source: 'agentgram' | 'external' | 'official';
  is_atelier_official?: number;
}

interface ServiceCardProps {
  service: Service;
  agent?: AgentAttribution;
  showAgent?: boolean;
  onHire?: () => void;
}

export function ServiceCard({ service, agent, showAgent = false, onHire }: ServiceCardProps) {
  const cat = CATEGORY_CONFIG[service.category] || CATEGORY_CONFIG.custom;

  return (
    <div className="p-5 rounded-lg bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-neutral-800 hover:border-atelier/40 dark:hover:border-atelier/40 transition-all duration-200 group">
      {/* Header: category + rating */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-atelier/10 flex items-center justify-center text-atelier">
            {cat.icon}
          </div>
          <span className="text-xs font-mono text-atelier font-medium">
            {cat.label}
          </span>
        </div>
        {service.avg_rating != null && (
          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-neutral-500 font-mono">
            <svg className="w-3.5 h-3.5 text-atelier" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {service.avg_rating.toFixed(1)}
          </span>
        )}
      </div>

      {/* Agent attribution */}
      {showAgent && agent && (
        <Link
          href={atelierHref(`/atelier/agents/${agent.id}`)}
          className="flex items-center gap-2 mb-3 group/agent"
        >
          {agent.avatar_url ? (
            <img src={agent.avatar_url} alt={agent.name} className="w-5 h-5 rounded object-cover" />
          ) : (
            <div className="w-5 h-5 rounded bg-atelier/15 flex items-center justify-center text-atelier text-2xs font-bold font-mono">
              {agent.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-xs font-mono text-gray-500 dark:text-neutral-500 group-hover/agent:text-atelier transition-colors duration-150">
            {agent.name}
          </span>
          {agent.is_atelier_official === 1 && (
            <span className="px-1.5 py-0.5 rounded text-2xs font-mono bg-atelier/10 text-atelier">
              by ATELIER
            </span>
          )}
          {agent.source === 'agentgram' && (
            <span className="px-1.5 py-0.5 rounded text-2xs font-mono bg-orange/10 text-orange">
              AgentGram
            </span>
          )}
        </Link>
      )}

      {/* Title + description */}
      <h3 className="font-semibold font-display text-black dark:text-white mb-1.5">{service.title}</h3>
      <p className="text-sm text-gray-500 dark:text-neutral-400 mb-4 line-clamp-2">{service.description}</p>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-3">
        {service.completed_orders > 0 && (
          <span className="text-xs text-gray-500 dark:text-neutral-500 font-mono">
            {service.completed_orders} orders
          </span>
        )}
        {service.turnaround_hours > 0 && (
          <span className="text-xs text-gray-500 dark:text-neutral-500 font-mono">
            ~{service.turnaround_hours}h delivery
          </span>
        )}
        {service.provider_model && (
          <span className="px-1.5 py-0.5 rounded text-2xs font-mono bg-gray-200 dark:bg-neutral-800/60 text-gray-500 dark:text-neutral-400">
            {service.provider_model}
          </span>
        )}
      </div>

      {/* Deliverables */}
      {service.deliverables && (
        <p className="text-xs text-gray-400 dark:text-neutral-600 font-mono mb-4 line-clamp-1">
          Deliverables: {service.deliverables}
        </p>
      )}

      {/* Hire CTA */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-neutral-800/50">
        <span className="text-atelier font-mono font-semibold text-sm">
          {service.price_type === 'fixed' ? `$${service.price_usd}` : 'Get Quote'}
        </span>
        <button
          onClick={onHire}
          className="px-4 py-1.5 rounded bg-atelier text-white text-xs font-semibold font-mono uppercase tracking-wide translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200 btn-atelier btn-primary"
        >
          Hire
        </button>
      </div>
    </div>
  );
}
