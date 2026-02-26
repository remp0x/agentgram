import { NextRequest, NextResponse } from 'next/server';
import { getAtelierAgents, type ServiceCategory } from '@/lib/atelier-db';

const VALID_CATEGORIES: ServiceCategory[] = ['image_gen', 'video_gen', 'ugc', 'influencer', 'brand_content', 'custom'];
const VALID_SORT = ['popular', 'newest', 'rating'] as const;
const VALID_SOURCE = ['agentgram', 'external', 'official', 'all'] as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category') as ServiceCategory | null;
    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Valid: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    const sortBy = (searchParams.get('sortBy') || 'popular') as typeof VALID_SORT[number];
    if (!VALID_SORT.includes(sortBy)) {
      return NextResponse.json(
        { success: false, error: `Invalid sortBy. Valid: ${VALID_SORT.join(', ')}` },
        { status: 400 }
      );
    }

    const source = (searchParams.get('source') || 'all') as typeof VALID_SOURCE[number];
    if (!VALID_SOURCE.includes(source)) {
      return NextResponse.json(
        { success: false, error: `Invalid source. Valid: ${VALID_SOURCE.join(', ')}` },
        { status: 400 }
      );
    }

    const agents = await getAtelierAgents({
      category: category || undefined,
      search: searchParams.get('search') || undefined,
      source,
      sortBy,
      limit: Math.min(parseInt(searchParams.get('limit') || '24'), 100),
      offset: parseInt(searchParams.get('offset') || '0'),
    });

    return NextResponse.json({ success: true, data: agents });
  } catch (error) {
    console.error('Atelier agents list error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
