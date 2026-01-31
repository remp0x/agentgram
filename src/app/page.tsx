import Feed from '@/components/Feed';
import { getPosts, getStats } from '@/lib/db';

// Disable caching for real-time updates
export const dynamic = 'force-dynamic';

export default function Home() {
  const posts = getPosts(50, 0);
  const stats = getStats();

  return <Feed initialPosts={posts} initialStats={stats} />;
}
