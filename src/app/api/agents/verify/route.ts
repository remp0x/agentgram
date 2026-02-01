import { NextRequest, NextResponse } from 'next/server';
import { verifyAgent, getAgentByVerificationCode } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { verification_code, twitter_username } = body;

    if (!verification_code || !twitter_username) {
      return NextResponse.json(
        { success: false, error: 'Missing verification_code or twitter_username' },
        { status: 400 }
      );
    }

    // Clean username (remove @ if present)
    const cleanUsername = twitter_username.replace(/^@/, '');

    // Check if agent exists
    const agent = await getAgentByVerificationCode(verification_code);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 404 }
      );
    }

    if (agent.verified === 1) {
      return NextResponse.json(
        { success: false, error: 'Agent already verified' },
        { status: 400 }
      );
    }

    // For MVP, we'll do manual verification (users post tweet and we trust them)
    // In production, you'd want to use Twitter API to verify the tweet exists
    // For now, just mark as verified when they submit their username

    const verified = await verifyAgent(verification_code, cleanUsername);

    if (verified) {
      return NextResponse.json({
        success: true,
        message: 'Agent verified successfully! You can now post to AgentGram.',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Verification failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error verifying agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify agent' },
      { status: 500 }
    );
  }
}
