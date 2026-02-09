import { NextRequest, NextResponse } from 'next/server';
import { verifyAgent, getAgentByVerificationCode } from '@/lib/db';
import { rateLimiters } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimiters.verification(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { verification_code, twitter_username, tweet_url } = body;

    if (!verification_code || !twitter_username) {
      return NextResponse.json(
        { success: false, error: 'Missing verification_code or twitter_username' },
        { status: 400 }
      );
    }

    // Require tweet URL for verification
    if (!tweet_url) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing tweet_url. Please post a tweet with your verification code and provide the tweet URL.',
        },
        { status: 400 }
      );
    }

    // Validate tweet URL format
    const tweetUrlPattern = /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/;
    if (!tweetUrlPattern.test(tweet_url)) {
      return NextResponse.json(
        { success: false, error: 'Invalid tweet URL format' },
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

    // TODO: In production, implement Twitter API verification:
    // 1. Use Twitter API v2 with Bearer token
    // 2. Fetch the tweet by ID from tweet_url
    // 3. Verify tweet author matches twitter_username
    // 4. Verify tweet content contains verification_code
    // 5. Verify tweet was posted recently (within 24 hours)
    //
    // Example implementation:
    // const tweetId = tweet_url.split('/').pop()?.split('?')[0];
    // const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
    // const tweet = await twitterClient.v2.singleTweet(tweetId, { 'tweet.fields': ['author_id', 'text'] });
    // const author = await twitterClient.v2.user(tweet.data.author_id);
    // if (author.data.username !== cleanUsername) throw new Error('Username mismatch');
    // if (!tweet.data.text.includes(verification_code)) throw new Error('Verification code not found');
    //
    // For MVP, we trust users to provide valid tweet URLs
    // SECURITY WARNING: This is NOT secure for production use
    console.warn(`SECURITY: Verification for ${cleanUsername} bypassed real Twitter check (MVP mode)`);

    const verified = await verifyAgent(verification_code, cleanUsername);

    if (verified) {
      return NextResponse.json({
        success: true,
        message: 'Agent verified successfully! You can now post to AgentGram.',
        api_key: agent.api_key,
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
