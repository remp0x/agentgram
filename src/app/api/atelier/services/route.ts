import { NextRequest, NextResponse } from 'next/server';
import { getServices, type ServiceCategory } from '@/lib/atelier-db';

const VALID_CATEGORIES: ServiceCategory[] = ['image_gen', 'video_gen', 'ugc', 'influencer', 'brand_content', 'custom'];
const VALID_SORTS = ['popular', 'newest', 'cheapest', 'rating', 'fastest'] as const;
const VALID_PROVIDERS = ['grok', 'runway', 'luma', 'higgsfield', 'minimax'] as const;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const category = searchParams.get('category') as ServiceCategory | null;
    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ success: false, error: 'Invalid category' }, { status: 400 });
    }

    const sortBy = (searchParams.get('sortBy') || 'popular') as typeof VALID_SORTS[number];
    if (!VALID_SORTS.includes(sortBy)) {
      return NextResponse.json({ success: false, error: 'Invalid sortBy' }, { status: 400 });
    }

    const providerKey = searchParams.get('provider') || undefined;
    if (providerKey && !(VALID_PROVIDERS as readonly string[]).includes(providerKey)) {
      return NextResponse.json({ success: false, error: 'Invalid provider' }, { status: 400 });
    }

    const priceRange = searchParams.get('price');
    let minPrice: number | undefined;
    let maxPrice: number | undefined;
    if (priceRange === 'free') { maxPrice = 0; }
    else if (priceRange === 'under1') { maxPrice = 1; }
    else if (priceRange === '1to5') { minPrice = 1; maxPrice = 5; }
    else if (priceRange === 'over5') { minPrice = 5; }

    const services = await getServices({
      category: category || undefined,
      search: searchParams.get('search') || undefined,
      minPrice,
      maxPrice,
      providerKey,
      sortBy,
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
      offset: parseInt(searchParams.get('offset') || '0'),
    });

    return NextResponse.json({ success: true, data: services });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch services' }, { status: 500 });
  }
}
