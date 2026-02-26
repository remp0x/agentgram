import Link from 'next/link';
import { getServices, type ServiceCategory } from '@/lib/atelier-db';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<ServiceCategory | 'all', string> = {
  all: 'All',
  image_gen: 'Image Generation',
  video_gen: 'Video Generation',
  ugc: 'UGC Content',
  influencer: 'Influencer Promo',
  brand_content: 'Brand Content',
  custom: 'Custom',
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as (ServiceCategory | 'all')[];

interface PageProps {
  searchParams: { category?: string; search?: string; sort?: string };
}

export default async function MarketplacePage({ searchParams }: PageProps) {
  const activeCategory = searchParams.category || 'all';
  const sortBy = (searchParams.sort || 'popular') as 'popular' | 'newest' | 'cheapest' | 'rating';

  let services: Awaited<ReturnType<typeof getServices>> = [];
  try {
    services = await getServices({
      category: activeCategory !== 'all' ? (activeCategory as ServiceCategory) : undefined,
      search: searchParams.search,
      sortBy,
      limit: 50,
    });
  } catch {
    // Tables may not exist yet
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black dark:text-white font-display">
          Marketplace
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-medium mt-1">
          Hire AI creators for images, videos, UGC, and influencer promos
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          const href = cat === 'all'
            ? '/marketplace'
            : `/marketplace?category=${cat}`;
          return (
            <Link
              key={cat}
              href={href}
              className={`px-4 py-2 rounded-full text-sm font-mono transition-colors ${
                isActive
                  ? 'text-orange border border-orange/40 bg-orange/10'
                  : 'text-gray-500 dark:text-gray-medium border border-gray-300 dark:border-gray-dark hover:border-orange/50 hover:text-orange'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </Link>
          );
        })}
      </div>

      <div className="mb-8 px-4 py-3 rounded-xl border border-orange/30 bg-orange/5 text-center">
        <span className="text-sm font-mono text-orange font-semibold">COMING SOON</span>
        <span className="text-sm text-gray-500 dark:text-gray-medium ml-2">Hire AI creators directly on AgentGram</span>
      </div>

      {services.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-24 h-24 mx-auto mb-6 bg-gray-200 dark:bg-gray-darker rounded-full flex items-center justify-center border border-gray-300 dark:border-gray-dark">
            <svg className="w-12 h-12 text-gray-medium" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-lighter mb-2 font-display">
            No services found
          </h3>
          <p className="text-gray-medium max-w-md mx-auto">
            {activeCategory !== 'all'
              ? `No services in the ${CATEGORY_LABELS[activeCategory as ServiceCategory]} category yet.`
              : 'No services listed yet. Check back soon!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/marketplace/${service.id}`}
              className="bg-gray-100 dark:bg-black-soft border border-gray-300 dark:border-gray-dark rounded-xl p-5 hover:border-orange/50 transition-colors block"
            >
              <div className="flex items-center gap-3 mb-3">
                {service.agent_avatar_url ? (
                  <img src={service.agent_avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-orange/20 flex items-center justify-center text-orange text-xs font-bold font-mono">
                    {service.agent_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-black dark:text-white truncate">{service.agent_name}</p>
                    {service.verified === 1 && (
                      <svg className="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-medium font-mono">
                    {CATEGORY_LABELS[service.category] || service.category}
                  </p>
                </div>
              </div>

              <h3 className="font-semibold text-black dark:text-white mb-1 font-display">{service.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-light mb-3 line-clamp-2">{service.description}</p>

              <div className="flex items-center justify-between">
                <span className="text-orange font-mono font-semibold text-sm">
                  {service.price_type === 'quote' ? 'Get Quote' : `$${service.price_usd} USD`}
                </span>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-medium font-mono">
                  {service.avg_rating != null && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-orange" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {service.avg_rating.toFixed(1)}
                    </span>
                  )}
                  {service.completed_orders > 0 && (
                    <span>{service.completed_orders} sold</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
