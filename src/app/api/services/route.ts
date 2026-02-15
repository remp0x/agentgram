import { NextRequest, NextResponse } from 'next/server';
import { getServices, createService, getAgentByApiKey, ServiceCategory } from '@/lib/db';
import { rateLimiters } from '@/lib/rateLimit';

const VALID_CATEGORIES: ServiceCategory[] = ['image_gen', 'video_gen', 'ugc', 'influencer', 'brand_content', 'custom'];
const VALID_SORT_BY = ['popular', 'newest', 'cheapest', 'rating'] as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category') as ServiceCategory | null;
    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    const search = searchParams.get('search') || undefined;

    const minPriceRaw = searchParams.get('minPrice');
    const minPrice = minPriceRaw ? parseFloat(minPriceRaw) : undefined;
    if (minPrice !== undefined && isNaN(minPrice)) {
      return NextResponse.json(
        { success: false, error: 'minPrice must be a valid number' },
        { status: 400 }
      );
    }

    const maxPriceRaw = searchParams.get('maxPrice');
    const maxPrice = maxPriceRaw ? parseFloat(maxPriceRaw) : undefined;
    if (maxPrice !== undefined && isNaN(maxPrice)) {
      return NextResponse.json(
        { success: false, error: 'maxPrice must be a valid number' },
        { status: 400 }
      );
    }

    const minRatingRaw = searchParams.get('minRating');
    const minRating = minRatingRaw ? parseFloat(minRatingRaw) : undefined;
    if (minRating !== undefined && isNaN(minRating)) {
      return NextResponse.json(
        { success: false, error: 'minRating must be a valid number' },
        { status: 400 }
      );
    }

    const sortByRaw = searchParams.get('sortBy') as typeof VALID_SORT_BY[number] | null;
    if (sortByRaw && !VALID_SORT_BY.includes(sortByRaw)) {
      return NextResponse.json(
        { success: false, error: `Invalid sortBy. Must be one of: ${VALID_SORT_BY.join(', ')}` },
        { status: 400 }
      );
    }

    const limitRaw = searchParams.get('limit');
    const limit = limitRaw ? parseInt(limitRaw) : 50;
    if (isNaN(limit)) {
      return NextResponse.json(
        { success: false, error: 'limit must be a valid number' },
        { status: 400 }
      );
    }

    const offsetRaw = searchParams.get('offset');
    const offset = offsetRaw ? parseInt(offsetRaw) : 0;
    if (isNaN(offset)) {
      return NextResponse.json(
        { success: false, error: 'offset must be a valid number' },
        { status: 400 }
      );
    }

    const services = await getServices({
      category: category || undefined,
      search,
      minPrice,
      maxPrice,
      minRating,
      sortBy: sortByRaw || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimiters.services(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <your_api_key>' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);

    const agent = await getAgentByApiKey(apiKey);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    if (agent.verified !== 1) {
      return NextResponse.json(
        { success: false, error: 'Agent not verified. Please complete verification before creating services.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { category, title, description, price_usd, price_type, turnaround_hours, deliverables, portfolio_post_ids, demo_url } = body;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Invalid or missing category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string' || title.length < 3 || title.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Title must be between 3 and 100 characters' },
        { status: 400 }
      );
    }

    if (!description || typeof description !== 'string' || description.length < 10 || description.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Description must be between 10 and 500 characters' },
        { status: 400 }
      );
    }

    if (!price_usd || isNaN(parseFloat(price_usd)) || parseFloat(price_usd) <= 0) {
      return NextResponse.json(
        { success: false, error: 'price_usd must be a positive number' },
        { status: 400 }
      );
    }

    if (!price_type || (price_type !== 'fixed' && price_type !== 'quote')) {
      return NextResponse.json(
        { success: false, error: 'price_type must be either "fixed" or "quote"' },
        { status: 400 }
      );
    }

    if (turnaround_hours !== undefined) {
      const parsed = parseInt(turnaround_hours);
      if (isNaN(parsed) || parsed <= 0) {
        return NextResponse.json(
          { success: false, error: 'turnaround_hours must be a positive integer' },
          { status: 400 }
        );
      }
    }

    const service = await createService({
      agent_id: agent.id,
      category,
      title,
      description,
      price_usd: String(price_usd),
      price_type,
      turnaround_hours: turnaround_hours ? parseInt(turnaround_hours) : undefined,
      deliverables,
      portfolio_post_ids,
      demo_url,
    });

    return NextResponse.json({
      success: true,
      data: service,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create service' },
      { status: 500 }
    );
  }
}
