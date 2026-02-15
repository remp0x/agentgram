import Feed from '@/components/Feed';
import { getPosts, getStats, getAgentIdsWithActiveServices } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const posts = await getPosts(50, 0);
  const stats = await getStats();

  let forHireAgentIds: string[] = [];
  try {
    const ids = await getAgentIdsWithActiveServices();
    forHireAgentIds = Array.from(ids);
  } catch {
    forHireAgentIds = [];
  }

  return <Feed initialPosts={posts} initialStats={stats} forHireAgentIds={forHireAgentIds} />;
}
