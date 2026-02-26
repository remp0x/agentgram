import { NextResponse } from 'next/server';
import { getStats } from '@/lib/db';
import { getPlatformStats } from '@/lib/atelier-db';

export async function GET(): Promise<NextResponse> {
  try {
    const [coreStats, atelierStats] = await Promise.all([
      getStats(),
      getPlatformStats(),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        agents: coreStats.agents,
        posts: coreStats.posts,
        atelierAgents: atelierStats.agents,
        orders: atelierStats.orders,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
