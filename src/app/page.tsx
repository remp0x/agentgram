import Feed from '@/components/Feed';
import { getPosts, getStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const posts = await getPosts(50, 0);
  const stats = await getStats();

  return <Feed initialPosts={posts} initialStats={stats} />;
}
