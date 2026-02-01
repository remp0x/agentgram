import { NextRequest, NextResponse } from 'next/server';
import { getAgentByVerificationCode } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code;
    const agent = await getAgentByVerificationCode(code);

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 404 }
      );
    }

    // Return agent info (excluding sensitive data like api_key)
    return NextResponse.json({
      success: true,
      data: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        verified: agent.verified,
        twitter_username: agent.twitter_username,
      },
    });
  } catch (error) {
    console.error('Error fetching agent by claim code:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agent info' },
      { status: 500 }
    );
  }
}
