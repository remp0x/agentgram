import { NextRequest, NextResponse } from 'next/server';
import { getAgentPosts, getFollowCounts, getAgent } from '@/lib/db';
import {
  getAtelierAgent,
  getServicesByAgent,
  getServiceReviews,
  getRecentOrdersForAgent,
  ensureAtelierAgent,
} from '@/lib/atelier-db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    let agent = await getAtelierAgent(id);

    if (!agent && !id.startsWith('ext_')) {
      const coreAgent = await getAgent(id);
      if (coreAgent) {
        agent = await ensureAtelierAgent(coreAgent);
      }
    }

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.source === 'external') {
      let capabilities: string[] = [];
      try { capabilities = JSON.parse(agent.capabilities); } catch { /* empty */ }

      const [services, recentOrders] = await Promise.all([
        getServicesByAgent(id),
        getRecentOrdersForAgent(id, 10),
      ]);

      const allReviews = await Promise.all(
        services.map((s) => getServiceReviews(s.id))
      );

      return NextResponse.json({
        success: true,
        data: {
          agent: {
            id: agent.id,
            name: agent.name,
            description: agent.description,
            avatar_url: agent.avatar_url,
            source: 'external' as const,
            verified: agent.verified,
            blue_check: 0,
            endpoint_url: agent.endpoint_url,
            capabilities,
            owner_wallet: agent.owner_wallet || null,
            token: {
              mint: agent.token_mint,
              name: agent.token_name,
              symbol: agent.token_symbol,
              image_url: agent.token_image_url,
              mode: agent.token_mode,
              creator_wallet: agent.token_creator_wallet,
              tx_hash: agent.token_tx_hash,
            },
          },
          services,
          portfolio: [],
          stats: {
            completed_orders: agent.completed_orders,
            avg_rating: agent.avg_rating,
            followers: 0,
            services_count: services.length,
          },
          reviews: allReviews.flat(),
          recentOrders,
        },
      });
    }

    const [services, posts, followCounts, recentOrders] = await Promise.all([
      getServicesByAgent(id),
      getAgentPosts(id, 12, 0),
      getFollowCounts(id),
      getRecentOrdersForAgent(id, 10),
    ]);

    const allReviews = await Promise.all(
      services.map((s) => getServiceReviews(s.id))
    );
    const reviews = allReviews.flat();

    const totalCompleted = services.reduce((sum, s) => sum + (s.completed_orders || 0), 0);
    const ratings = services.filter((s) => s.avg_rating != null).map((s) => s.avg_rating as number);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

    return NextResponse.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          bio: agent.bio,
          avatar_url: agent.avatar_url,
          source: agent.source,
          verified: agent.verified,
          blue_check: agent.blue_check,
          is_atelier_official: agent.is_atelier_official || 0,
          twitter_username: agent.twitter_username,
          owner_wallet: agent.owner_wallet || null,
          token: {
            mint: agent.token_mint,
            name: agent.token_name,
            symbol: agent.token_symbol,
            image_url: agent.token_image_url,
            mode: agent.token_mode,
            creator_wallet: agent.token_creator_wallet,
            tx_hash: agent.token_tx_hash,
          },
        },
        services,
        portfolio: posts,
        stats: {
          completed_orders: totalCompleted,
          avg_rating: avgRating,
          followers: followCounts.followers,
          services_count: services.length,
        },
        reviews,
        recentOrders,
      },
    });
  } catch (error) {
    console.error('Atelier agent detail error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
