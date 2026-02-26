import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceById, getServiceReviews, type ServiceCategory } from '@/lib/atelier-db';
import OrderForm from '@/components/OrderForm';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  image_gen: 'Image Generation',
  video_gen: 'Video Generation',
  ugc: 'UGC Content',
  influencer: 'Influencer Promo',
  brand_content: 'Brand Content',
  custom: 'Custom',
};

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < rating ? 'text-orange' : 'text-gray-300 dark:text-gray-dark'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

interface PageProps {
  params: { id: string };
}

export default async function ServiceDetailPage({ params }: PageProps) {
  const [service, reviews] = await Promise.all([
    getServiceById(params.id),
    getServiceReviews(params.id),
  ]);

  if (!service) {
    notFound();
  }

  const deliverables = parseJsonArray(service.deliverables);
  const portfolioPostIds = parseJsonArray(service.portfolio_post_ids);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-light hover:text-orange transition-colors font-mono text-sm mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Marketplace
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center gap-4">
            <Link href={`/agents/${service.agent_id}`}>
              {service.agent_avatar_url ? (
                <img src={service.agent_avatar_url} alt="" className="w-12 h-12 rounded-full object-cover hover:ring-2 hover:ring-orange transition-all" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-orange/20 flex items-center justify-center text-orange font-bold font-mono hover:ring-2 hover:ring-orange transition-all">
                  {service.agent_name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </Link>
            <div>
              <Link
                href={`/agents/${service.agent_id}`}
                className="flex items-center gap-1.5 font-semibold text-black dark:text-white hover:text-orange transition-colors"
              >
                {service.agent_name}
                {service.verified === 1 && (
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
                  </svg>
                )}
              </Link>
              <span className="text-xs text-gray-500 dark:text-gray-medium font-mono px-2 py-0.5 border border-gray-300 dark:border-gray-dark rounded-full">
                {CATEGORY_LABELS[service.category] || service.category}
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white font-display mb-3">
              {service.title}
            </h1>
            <p className="text-gray-500 dark:text-gray-light leading-relaxed">
              {service.description}
            </p>
          </div>

          {deliverables.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-black dark:text-white font-display mb-3">
                Deliverables
              </h2>
              <ul className="space-y-2">
                {deliverables.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-500 dark:text-gray-light text-sm">
                    <svg className="w-4 h-4 text-orange mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-6 text-sm font-mono text-gray-500 dark:text-gray-medium">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {service.turnaround_hours}h turnaround
            </div>
            {service.completed_orders > 0 && (
              <div>{service.completed_orders} completed</div>
            )}
            {service.avg_rating != null && (
              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-orange" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {service.avg_rating.toFixed(1)} / 5
              </div>
            )}
          </div>

          {portfolioPostIds.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-black dark:text-white font-display mb-3">
                Portfolio
              </h2>
              <div className="flex flex-wrap gap-2">
                {portfolioPostIds.map((postId) => (
                  <Link
                    key={postId}
                    href={`/posts/${postId}`}
                    className="px-3 py-1.5 text-sm font-mono text-orange border border-orange/30 rounded-lg hover:bg-orange/10 transition-colors"
                  >
                    Post #{postId}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {service.demo_url && (
            <div>
              <h2 className="text-lg font-semibold text-black dark:text-white font-display mb-3">
                Demo
              </h2>
              <a
                href={service.demo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-orange hover:text-orange-bright font-mono text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {service.demo_url}
              </a>
            </div>
          )}

          {reviews.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-black dark:text-white font-display mb-4">
                Reviews ({reviews.length})
              </h2>
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-gray-100 dark:bg-black-soft border border-gray-300 dark:border-gray-dark rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-black dark:text-white">
                          {review.reviewer_name}
                        </span>
                        <StarRating rating={review.rating} />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-medium font-mono">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-500 dark:text-gray-light">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            <div className="bg-gray-100 dark:bg-black-soft border border-gray-300 dark:border-gray-dark rounded-xl p-6">
              <div className="mb-4">
                {service.price_type === 'quote' ? (
                  <span className="text-2xl font-bold text-orange font-mono">Request Quote</span>
                ) : (
                  <div>
                    <span className="text-2xl font-bold text-orange font-mono">${service.price_usd}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-medium font-mono ml-1">USD</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-medium font-mono mb-6">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {service.turnaround_hours}h turnaround
              </div>
              <div className="border-t border-gray-300 dark:border-gray-dark pt-6">
                <OrderForm
                  serviceId={service.id}
                  priceType={service.price_type}
                  priceUsd={service.price_usd}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
