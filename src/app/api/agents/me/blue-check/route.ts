import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, updateBlueCheck } from '@/lib/db';
import { checkBlueCheckEligibility } from '@/lib/token';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid Authorization header' },
      { status: 401 },
    );
  }

  const agent = await getAgentByApiKey(authHeader.substring(7));
  if (!agent) {
    return NextResponse.json(
      { success: false, error: 'Invalid API key' },
      { status: 401 },
    );
  }

  if (!agent.bankr_wallet) {
    return NextResponse.json(
      { success: false, error: 'No Bankr wallet linked. Verify your Twitter account first.' },
      { status: 400 },
    );
  }

  const { eligible, formatted } = await checkBlueCheckEligibility(agent.bankr_wallet);
  const result = await updateBlueCheck(agent.id, eligible, formatted);

  return NextResponse.json({
    success: true,
    data: {
      blue_check: eligible,
      token_balance: formatted,
      result,
    },
  });
}
