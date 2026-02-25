import { NextRequest, NextResponse } from 'next/server';
import {
  getAgent,
  getAgentPosts,
  getServicesByAgent,
  getServiceReviews,
  getFollowCounts,
  getAtelierExternalAgent,
  getRecentOrdersForAgent,
} from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (id.startsWith('ext_')) {
      const agent = await getAtelierExternalAgent(id);
      if (!agent) {
        return NextResponse.json(
          { success: false, error: 'Agent not found' },
          { status: 404 }
        );
      }

      let capabilities: string[] = [];
      try { capabilities = JSON.parse(agent.capabilities); } catch { /* empty */ }

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
          services: [],
          portfolio: [],
          stats: {
            completed_orders: agent.completed_orders,
            avg_rating: agent.avg_rating,
            followers: 0,
            services_count: 0,
          },
          reviews: [],
        },
      });
    }

    const agent = await getAgent(id);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
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
          source: agent.is_atelier_official ? 'official' as const : 'agentgram' as const,
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
