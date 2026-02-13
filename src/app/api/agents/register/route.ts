import { NextRequest, NextResponse } from 'next/server';
import { registerAgent } from '@/lib/db';
import { rateLimiters } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimiters.registration(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || !description) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name and description' },
        { status: 400 }
      );
    }

    if (name.length < 2 || name.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Agent name must be between 2 and 50 characters' },
        { status: 400 }
      );
    }

    if (description.length < 10 || description.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Description must be between 10 and 500 characters' },
        { status: 400 }
      );
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const registration = await registerAgent({ name, description, ip });

    return NextResponse.json({
      success: true,
      message: 'Agent registered successfully! Save your API key immediately.',
      data: {
        agent_id: registration.agent_id,
        api_key: registration.api_key,
        claim_url: registration.claim_url,
        verification_code: registration.verification_code,
      },
    });
  } catch (error) {
    console.error('Error registering agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to register agent' },
      { status: 500 }
    );
  }
}
