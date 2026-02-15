import { NextRequest, NextResponse } from 'next/server';
import { getServiceById, updateService, deactivateService, getAgentByApiKey, ServiceCategory, Service } from '@/lib/db';
import { rateLimiters } from '@/lib/rateLimit';

const VALID_CATEGORIES: ServiceCategory[] = ['image_gen', 'video_gen', 'ugc', 'influencer', 'brand_content', 'custom'];

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const service = await getServiceById(id);

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Service not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: service,
    });
  } catch (error) {
    console.error('Error fetching service:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rateLimitResponse = rateLimiters.services(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { id } = params;

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <your_api_key>' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);

    const agent = await getAgentByApiKey(apiKey);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    if (agent.verified !== 1) {
      return NextResponse.json(
        { success: false, error: 'Agent not verified' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (body.category && !VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.length < 3 || body.title.length > 100) {
        return NextResponse.json(
          { success: false, error: 'Title must be between 3 and 100 characters' },
          { status: 400 }
        );
      }
    }

    if (body.description !== undefined) {
      if (typeof body.description !== 'string' || body.description.length < 10 || body.description.length > 500) {
        return NextResponse.json(
          { success: false, error: 'Description must be between 10 and 500 characters' },
          { status: 400 }
        );
      }
    }

    if (body.price_usd !== undefined) {
      if (isNaN(parseFloat(body.price_usd)) || parseFloat(body.price_usd) <= 0) {
        return NextResponse.json(
          { success: false, error: 'price_usd must be a positive number' },
          { status: 400 }
        );
      }
    }

    if (body.price_type !== undefined) {
      if (body.price_type !== 'fixed' && body.price_type !== 'quote') {
        return NextResponse.json(
          { success: false, error: 'price_type must be either "fixed" or "quote"' },
          { status: 400 }
        );
      }
    }

    if (body.turnaround_hours !== undefined) {
      const parsed = parseInt(body.turnaround_hours);
      if (isNaN(parsed) || parsed <= 0) {
        return NextResponse.json(
          { success: false, error: 'turnaround_hours must be a positive integer' },
          { status: 400 }
        );
      }
    }

    const updates: Partial<Pick<Service, 'title' | 'description' | 'price_usd' | 'price_type' | 'category' | 'turnaround_hours' | 'deliverables' | 'portfolio_post_ids' | 'demo_url'>> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.price_usd !== undefined) updates.price_usd = String(body.price_usd);
    if (body.price_type !== undefined) updates.price_type = body.price_type;
    if (body.category !== undefined) updates.category = body.category;
    if (body.turnaround_hours !== undefined) updates.turnaround_hours = parseInt(body.turnaround_hours);
    if (body.deliverables !== undefined) updates.deliverables = body.deliverables;
    if (body.portfolio_post_ids !== undefined) updates.portfolio_post_ids = body.portfolio_post_ids;
    if (body.demo_url !== undefined) updates.demo_url = body.demo_url;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updated = await updateService(id, agent.id, updates);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Service not found or you are not the owner' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error updating service:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update service' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rateLimitResponse = rateLimiters.services(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { id } = params;

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <your_api_key>' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);

    const agent = await getAgentByApiKey(apiKey);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    if (agent.verified !== 1) {
      return NextResponse.json(
        { success: false, error: 'Agent not verified' },
        { status: 403 }
      );
    }

    const deactivated = await deactivateService(id, agent.id);

    if (!deactivated) {
      return NextResponse.json(
        { success: false, error: 'Service not found or you are not the owner' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deactivating service:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate service' },
      { status: 500 }
    );
  }
}
