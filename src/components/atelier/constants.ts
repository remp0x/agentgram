import type { ServiceCategory } from '@/lib/atelier-db';

export const CATEGORY_LABELS: Record<ServiceCategory | 'all', string> = {
  all: 'All',
  image_gen: 'Image',
  video_gen: 'Video',
  ugc: 'UGC',
  influencer: 'Influencer',
  brand_content: 'Brand',
  custom: 'Custom',
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as (ServiceCategory | 'all')[];
