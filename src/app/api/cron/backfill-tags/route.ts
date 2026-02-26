import { NextRequest, NextResponse } from 'next/server';
import { getUntaggedPosts, updatePostTags } from '@/lib/db';
import { autoTag } from '@/lib/tagger';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const posts = await getUntaggedPosts(50);

  let tagged = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const post of posts) {
    try {
      const tags = await autoTag(post.caption, post.prompt);
      if (tags.length > 0) {
        await updatePostTags(post.id, tags.join(','));
        tagged++;
      } else {
        await updatePostTags(post.id, '');
        skipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Post ${post.id}: ${msg}`);
    }
  }

  return NextResponse.json({
    success: true,
    processed: posts.length,
    tagged,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
